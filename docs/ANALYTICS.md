# GymSphere Analytics Pipeline

## Overview

Three scripts in `analytics/` cover training data generation, model training and nightly scoring.
They are independent of the web and mobile apps; they only read and write to Supabase tables.

## Rerunning the pipeline

1. Create a virtual environment and install dependencies:
   `python -m venv .venv && source .venv/bin/activate && pip install -r analytics/requirements.txt`
2. Generate synthetic training data (safe to run repeatedly, writes CSVs under `analytics/data`):
   `python analytics/generate_synthetic_data.py --gyms 3 --members-per-gym 150 --days 180`
3. Train the churn model (prints AUC for both candidate models, precision/recall at the 0.6
   decision threshold used in production, and feature influence; saves the chosen model):
   `python analytics/churn_model.py`
4. Score real members nightly once the model exists. Copy `backend/.env.example` to
   `analytics/.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set, then run:
   `python analytics/score_members.py`
   This reads the `v_member_features` view, scores every active member, and inserts `churn_alert`
   rows (score above 0.6) with up to three plain-language reasons.
5. Schedule step 4 nightly with a free scheduler such as a GitHub Actions cron workflow, since
   Supabase's free-tier `pg_cron` can run SQL but not Python.

## Feature definitions

All features mirror the `v_member_features` SQL view so there is never a mismatch between what the
model was trained on and what it scores in production: `visits_7d`, `visits_30d`,
`visits_prev_30d`, `days_since_last_visit`, `days_to_expiry`, `avg_rating_given`, `tenure_days`.
The training script additionally encodes `late_payer` and `trainer_rating`, which in production are
approximated from payment history and the member's own average rating given, since a member does
not directly rate their own retention risk factors.
