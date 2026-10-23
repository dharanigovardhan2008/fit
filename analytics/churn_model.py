"""Trains a churn model on the synthetic data produced by generate_synthetic_data.py.

Features are computed as of 3 days before each subscription's end date:
  visits_7d, visits_30d, visits_prev_30d, days_since_last_visit, visit_trend,
  late_payer, trainer_rating, plan_days.
Label: 1 if the member did not renew (churned), 0 otherwise.

Trains logistic regression and gradient boosting, selects the better model by AUC, prints
precision/recall at a 0.6 threshold, prints feature influence, and saves the chosen model with
joblib to analytics/model/churn_model.joblib.

Usage:
    python analytics/generate_synthetic_data.py
    python analytics/churn_model.py
"""
from __future__ import annotations

import os

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")

FEATURE_COLUMNS = [
    "visits_7d", "visits_30d", "visits_prev_30d", "days_since_last_visit",
    "visit_trend", "late_payer", "trainer_rating", "plan_days",
]


def build_feature_table() -> pd.DataFrame:
    members = pd.read_csv(os.path.join(DATA_DIR, "members.csv"))
    attendance = pd.read_csv(os.path.join(DATA_DIR, "attendance.csv"), parse_dates=["attendance_date"])
    subscriptions = pd.read_csv(
        os.path.join(DATA_DIR, "subscriptions.csv"), parse_dates=["start_date", "end_date"]
    )

    rows = []
    attendance_by_member = {m: g.sort_values("attendance_date") for m, g in attendance.groupby("member_id")}

    for _, sub in subscriptions.iterrows():
        cutoff = sub["end_date"] - pd.Timedelta(days=3)
        visits = attendance_by_member.get(sub["member_id"])
        if visits is None:
            visits_7d = visits_30d = visits_prev_30d = 0
            days_since_last = 999
        else:
            past = visits[visits["attendance_date"] <= cutoff]
            visits_7d = (past["attendance_date"] > cutoff - pd.Timedelta(days=7)).sum()
            visits_30d = (past["attendance_date"] > cutoff - pd.Timedelta(days=30)).sum()
            visits_prev_30d = (
                (past["attendance_date"] <= cutoff - pd.Timedelta(days=30))
                & (past["attendance_date"] > cutoff - pd.Timedelta(days=60))
            ).sum()
            days_since_last = (cutoff - past["attendance_date"].max()).days if len(past) else 999

        member = members[members["member_id"] == sub["member_id"]].iloc[0]
        visit_trend = visits_30d - visits_prev_30d

        rows.append({
            "member_id": sub["member_id"],
            "visits_7d": visits_7d,
            "visits_30d": visits_30d,
            "visits_prev_30d": visits_prev_30d,
            "days_since_last_visit": min(days_since_last, 999),
            "visit_trend": visit_trend,
            "late_payer": int(member["late_payer"]),
            "trainer_rating": member["trainer_rating"],
            "plan_days": member["plan_days"],
            "churned": int(not sub["renewed"]),
        })

    return pd.DataFrame(rows)


def main():
    table = build_feature_table()
    X = table[FEATURE_COLUMNS]
    y = table["churned"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=7, stratify=y)

    logistic = Pipeline([("scale", StandardScaler()), ("clf", LogisticRegression(max_iter=1000))])
    logistic.fit(X_train, y_train)
    logistic_auc = roc_auc_score(y_test, logistic.predict_proba(X_test)[:, 1])

    boosting = GradientBoostingClassifier(random_state=7)
    boosting.fit(X_train, y_train)
    boosting_auc = roc_auc_score(y_test, boosting.predict_proba(X_test)[:, 1])

    print(f"logistic regression AUC: {logistic_auc:.3f}")
    print(f"gradient boosting AUC:  {boosting_auc:.3f}")

    best_name, best_model, best_auc = (
        ("gradient_boosting", boosting, boosting_auc)
        if boosting_auc >= logistic_auc
        else ("logistic_regression", logistic, logistic_auc)
    )
    print(f"selected model: {best_name} (AUC {best_auc:.3f})")

    probabilities = best_model.predict_proba(X_test)[:, 1]
    predictions = (probabilities >= 0.6).astype(int)
    print(f"precision at 0.6 threshold: {precision_score(y_test, predictions, zero_division=0):.3f}")
    print(f"recall at 0.6 threshold:    {recall_score(y_test, predictions, zero_division=0):.3f}")

    if best_name == "gradient_boosting":
        importances = dict(zip(FEATURE_COLUMNS, best_model.feature_importances_))
    else:
        importances = dict(zip(FEATURE_COLUMNS, np.abs(best_model.named_steps["clf"].coef_[0])))
    print("feature influence (higher means more influence on churn prediction):")
    for name, value in sorted(importances.items(), key=lambda kv: kv[1], reverse=True):
        print(f"  {name}: {value:.3f}")

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump({"model": best_model, "name": best_name, "features": FEATURE_COLUMNS},
                os.path.join(MODEL_DIR, "churn_model.joblib"))
    print(f"model saved to {os.path.join(MODEL_DIR, 'churn_model.joblib')}")


if __name__ == "__main__":
    main()
