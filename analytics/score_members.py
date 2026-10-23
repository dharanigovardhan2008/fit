"""Nightly scoring job: reads v_member_features from Supabase, scores every active member with
the trained churn model, and writes churn_alert rows for scores above 0.6 with up to three
plain-language reasons.

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (see backend/.env.example).
Intended to run as a scheduled task (free-tier cron such as GitHub Actions on a schedule) since
Supabase free tier pg_cron cannot call out to Python directly.

Usage:
    python analytics/score_members.py
"""
from __future__ import annotations

import os

import joblib
from dotenv import load_dotenv
from supabase import create_client

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "churn_model.joblib")
RISK_THRESHOLD = 0.6


def plain_language_reasons(row: dict) -> list[str]:
    reasons = []
    if row.get("days_since_last_visit") is not None and row["days_since_last_visit"] >= 10:
        reasons.append(f"No visit in {int(row['days_since_last_visit'])} days")
    visits_30 = row.get("visits_30d") or 0
    visits_prev = row.get("visits_prev_30d") or 0
    if visits_prev > 0 and visits_30 < visits_prev:
        drop_pct = round((1 - visits_30 / visits_prev) * 100)
        if drop_pct >= 30:
            reasons.append(f"Attendance down {drop_pct} percent")
    days_to_expiry = row.get("days_to_expiry")
    if days_to_expiry is not None and days_to_expiry <= 7:
        reasons.append(f"Subscription ends in {max(int(days_to_expiry), 0)} days")
    if row.get("avg_rating_given") is not None and row["avg_rating_given"] < 3:
        reasons.append("Low satisfaction rating given")
    if not reasons:
        reasons.append("Overall engagement trending down")
    return reasons[:3]


def main():
    load_dotenv()
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)

    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    features = bundle["features"]

    rows = client.table("v_member_features").select("*").execute().data

    alerts = []
    for row in rows:
        feature_values = []
        for name in features:
            if name == "visit_trend":
                value = (row.get("visits_30d") or 0) - (row.get("visits_prev_30d") or 0)
            elif name == "late_payer":
                value = 0
            elif name == "trainer_rating":
                value = row.get("avg_rating_given") or 3
            elif name == "plan_days":
                value = 30
            else:
                value = row.get(name) or 0
            feature_values.append(value)

        score = float(model.predict_proba([feature_values])[0][1])
        if score >= RISK_THRESHOLD:
            alerts.append({
                "gym_id": row["gym_id"],
                "member_id": row["member_id"],
                "risk_score": round(score, 3),
                "reasons": plain_language_reasons(row),
            })

    if alerts:
        client.table("churn_alert").insert(alerts).execute()
    print(f"scored {len(rows)} members, wrote {len(alerts)} churn alerts")


if __name__ == "__main__":
    main()
