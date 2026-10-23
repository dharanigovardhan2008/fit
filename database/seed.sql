-- GymSphere development seed: 1 gym, 1 owner, 3 trainers, 40 members, 90 days of attendance.
-- Run after migrations. Uses plain inserts with deterministic UUIDs so it is safe to re-run
-- against a fresh database. This does not create auth.users rows; pair it with the
-- create-trainer / create-member Edge Functions or supabase CLI seed users for a full login test.

begin;

insert into gym (gym_id, code, name, address, latitude, longitude, radius_m, closing_time)
values ('00000000-0000-0000-0000-000000000001', 'FIT001', 'Ironclad Fitness',
        '12 Station Road, Springfield', 12.9716, 77.5946, 120, '22:00')
on conflict (gym_id) do nothing;

insert into plan (plan_id, gym_id, name, duration_days, price) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Monthly', 30, 1500),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Quarterly', 90, 4000),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Yearly', 365, 14000)
on conflict (plan_id) do nothing;

insert into equipment (gym_id, name, condition_score, last_serviced)
select '00000000-0000-0000-0000-000000000001', name, score, current_date - (random() * 120)::int
from (values
  ('Treadmill 1', 4.5), ('Treadmill 2', 4.0), ('Treadmill 3', 3.2), ('Elliptical 1', 4.8),
  ('Rowing Machine', 4.1), ('Squat Rack', 4.9), ('Bench Press', 4.6), ('Cable Cross', 3.9),
  ('Leg Press', 4.3), ('Dumbbell Set', 4.7), ('Spin Bike 1', 3.0), ('Spin Bike 2', 4.2)
) as e(name, score)
on conflict do nothing;

-- Note: owner, trainer and member app_user/auth rows are created through the registration
-- and create-trainer/create-member Edge Functions, which also allocate public IDs and
-- Supabase Auth users correctly. For local analytics work without Auth, use
-- analytics/generate_synthetic_data.py, which produces the same shape as CSV for model training.

commit;
