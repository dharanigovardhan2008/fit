-- GymSphere migration 0003: attendance, equipment, ratings, requests, logs

create table if not exists attendance (
  att_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  member_id uuid not null references member(user_id) on delete cascade,
  attendance_date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  in_method attend_method,
  out_method attend_method,
  distance_m double precision,
  edited_by uuid references app_user(user_id),
  unique (member_id, attendance_date),
  check (check_out is null or check_in is null or check_out > check_in)
);

create table if not exists equipment (
  equipment_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  name text not null,
  condition_score numeric(3, 2) not null default 5,
  last_serviced date
);

create table if not exists rating (
  rating_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  member_id uuid not null references member(user_id) on delete cascade,
  trainer_id uuid references trainer(user_id),
  equipment_id uuid references equipment(equipment_id),
  score int not null check (score between 1 and 5),
  comment text,
  period_start date not null default date_trunc('month', current_date),
  created_at timestamptz not null default now(),
  check (trainer_id is not null or equipment_id is not null)
);

create table if not exists change_request (
  req_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  member_id uuid not null references member(user_id) on delete cascade,
  from_trainer uuid references trainer(user_id),
  to_trainer uuid references trainer(user_id),
  reason text,
  status request_status not null default 'pending',
  decided_by uuid references app_user(user_id),
  created_at timestamptz not null default now()
);

create table if not exists salary_payment (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  trainer_id uuid not null references trainer(user_id) on delete cascade,
  month date not null,
  amount numeric(10, 2) not null,
  paid_on date not null default current_date,
  unique (trainer_id, month)
);

create table if not exists body_metric (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  member_id uuid not null references member(user_id) on delete cascade,
  recorded_on date not null default current_date,
  weight_kg numeric(5, 2),
  waist_cm numeric(5, 2)
);

create table if not exists notification (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  user_id uuid not null references app_user(user_id) on delete cascade,
  type text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists churn_alert (
  alert_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  member_id uuid not null references member(user_id) on delete cascade,
  risk_score numeric(4, 3) not null,
  reasons jsonb not null default '[]',
  created_on date not null default current_date
);

create table if not exists event (
  event_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  type text not null,
  actor_id uuid references app_user(user_id),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists attendance_audit (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  att_id uuid not null references attendance(att_id) on delete cascade,
  changed_by uuid references app_user(user_id),
  old_values jsonb,
  new_values jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists idx_attendance_gym_date on attendance(gym_id, attendance_date);
create index if not exists idx_event_gym_created on event(gym_id, created_at);
