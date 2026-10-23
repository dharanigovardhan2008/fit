"""Generates synthetic gym data for churn model training.

Produces CSV files under analytics/data/: gyms.csv, members.csv, attendance.csv,
subscriptions.csv. The data encodes realistic structure: a hidden per-member motivation
level that drives attendance decay, a late-payer flag, and a trainer rating, so that the
resulting subscription renewal outcome correlates with recent visits, payment behaviour and
trainer rating in the way churn_model.py is expected to learn.

Usage:
    python analytics/generate_synthetic_data.py --gyms 3 --members-per-gym 150 --days 180
"""
from __future__ import annotations

import argparse
import os
import random
from datetime import date, timedelta

import numpy as np
import pandas as pd

PLANS = [("Monthly", 30, 1500.0), ("Quarterly", 90, 4000.0), ("Yearly", 365, 14000.0)]


def generate(gyms: int, members_per_gym: int, days: int, seed: int = 7) -> dict[str, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    random.seed(seed)

    gym_rows = []
    member_rows = []
    attendance_rows = []
    subscription_rows = []

    today = date.today()
    start_history = today - timedelta(days=days)

    member_id_counter = 10001
    sub_id_counter = 1
    att_id_counter = 1

    for gym_index in range(1, gyms + 1):
        gym_id = f"GYM{gym_index:03d}"
        gym_rows.append({"gym_id": gym_id, "name": f"Gym {gym_index}"})

        for _ in range(members_per_gym):
            member_id = f"M{member_id_counter}"
            member_id_counter += 1

            age = int(rng.normal(30, 8))
            age = max(16, min(65, age))
            gender = random.choice(["male", "female", "other"])
            motivation = rng.beta(2, 2)  # 0..1, hidden, drives attendance decay
            trainer_rating = round(float(np.clip(rng.normal(3.8 + motivation, 0.6), 1, 5)), 2)
            late_payer = rng.random() < (0.35 - 0.25 * motivation)
            plan_name, plan_days, plan_price = random.choice(PLANS)

            join_offset = rng.integers(0, days - 30)
            join_date = start_history + timedelta(days=int(join_offset))

            member_rows.append({
                "gym_id": gym_id,
                "member_id": member_id,
                "age": age,
                "gender": gender,
                "plan_name": plan_name,
                "plan_days": plan_days,
                "plan_price": plan_price,
                "join_date": join_date.isoformat(),
                "motivation": round(float(motivation), 3),
                "trainer_rating": trainer_rating,
                "late_payer": bool(late_payer),
            })

            # Attendance: probability of visiting a given day decays over tenure for
            # low-motivation members, stays stable for high-motivation members.
            cursor = join_date
            tenure_days = 0
            while cursor <= today:
                tenure_days = (cursor - join_date).days
                decay = max(0.1, motivation - 0.002 * tenure_days * (1 - motivation))
                base_rate = 0.15 + 0.55 * decay
                if rng.random() < base_rate:
                    hour = int(np.clip(rng.normal(18 if motivation > 0.4 else 8, 3), 6, 21))
                    attendance_rows.append({
                        "gym_id": gym_id,
                        "member_id": member_id,
                        "attendance_date": cursor.isoformat(),
                        "hour": hour,
                    })
                    att_id_counter += 1
                cursor += timedelta(days=1)

            # Subscriptions: one per plan cycle since joining, renewal probability depends on
            # recent visits, late payment and trainer rating.
            cycle_start = join_date
            while cycle_start <= today:
                cycle_end = cycle_start + timedelta(days=plan_days)
                visits_last_30 = sum(
                    1 for a in attendance_rows
                    if a["member_id"] == member_id
                    and cycle_end - timedelta(days=30) <= date.fromisoformat(a["attendance_date"]) <= cycle_end
                )
                renewal_score = (
                    0.5 * min(visits_last_30 / 12, 1)
                    + 0.3 * (trainer_rating / 5)
                    - 0.3 * (1 if late_payer else 0)
                    + 0.1
                )
                will_renew = rng.random() < np.clip(renewal_score, 0.03, 0.95)
                status = "active" if cycle_end >= today else ("active" if will_renew else "expired")

                subscription_rows.append({
                    "gym_id": gym_id,
                    "sub_id": sub_id_counter,
                    "member_id": member_id,
                    "plan_name": plan_name,
                    "start_date": cycle_start.isoformat(),
                    "end_date": cycle_end.isoformat(),
                    "status": status,
                    "renewed": bool(will_renew),
                })
                sub_id_counter += 1
                if not will_renew:
                    break
                cycle_start = cycle_end

    return {
        "gyms": pd.DataFrame(gym_rows),
        "members": pd.DataFrame(member_rows),
        "attendance": pd.DataFrame(attendance_rows),
        "subscriptions": pd.DataFrame(subscription_rows),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gyms", type=int, default=2)
    parser.add_argument("--members-per-gym", type=int, default=120)
    parser.add_argument("--days", type=int, default=180)
    parser.add_argument("--out", type=str, default=os.path.join(os.path.dirname(__file__), "data"))
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    frames = generate(args.gyms, args.members_per_gym, args.days)
    for name, frame in frames.items():
        path = os.path.join(args.out, f"{name}.csv")
        frame.to_csv(path, index=False)
        print(f"wrote {len(frame)} rows to {path}")


if __name__ == "__main__":
    main()
