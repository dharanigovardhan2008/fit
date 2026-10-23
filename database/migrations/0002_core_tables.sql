-- GymSphere migration 0002: gym, identity and membership core tables

create table if not exists gym (
  gym_id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  radius_m int not null default 100,
  closing_time time not null default '22:00',
  created_at timestamptz not null default now()
);

create table if not exists id_counter (
  gym_id uuid not null references gym(gym_id) on delete cascade,
  role user_role not null,
  last_number int not null default 10000,
  primary key (gym_id, role)
);

create table if not exists app_user (
  user_id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete cascade,
  gym_id uuid not null references gym(gym_id) on delete cascade,
  public_id text not null,
  role user_role not null,
  name text not null,
  age int check (age between 10 and 100),
  gender gender_type,
  phone text,
  email text not null unique,
  must_change_password boolean not null default true,
  temp_password_expiry timestamptz,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (gym_id, public_id)
);

create table if not exists trainer (
  user_id uuid primary key references app_user(user_id) on delete cascade,
  gym_id uuid not null references gym(gym_id) on delete cascade,
  salary numeric(10, 2) not null default 0,
  specialty text,
  shift shift_type not null default 'full',
  max_capacity int not null default 25,
  joined_on date not null default current_date
);

create table if not exists member (
  user_id uuid primary key references app_user(user_id) on delete cascade,
  gym_id uuid not null references gym(gym_id) on delete cascade,
  assigned_trainer_id uuid references trainer(user_id),
  goal text,
  preferred_shift shift_type not null default 'full',
  joined_on date not null default current_date,
  waitlisted boolean not null default false
);

create table if not exists plan (
  plan_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  name text not null,
  duration_days int not null,
  price numeric(10, 2) not null
);

create table if not exists subscription (
  sub_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  member_id uuid not null references member(user_id) on delete cascade,
  plan_id uuid not null references plan(plan_id),
  start_date date not null default current_date,
  end_date date not null,
  status sub_status not null default 'active'
);

create table if not exists payment (
  payment_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gym(gym_id) on delete cascade,
  sub_id uuid not null references subscription(sub_id) on delete cascade,
  amount numeric(10, 2) not null,
  mode payment_mode not null default 'cash',
  paid_at timestamptz not null default now(),
  reference text
);

create index if not exists idx_subscription_gym_end on subscription(gym_id, end_date);
create index if not exists idx_member_trainer on member(assigned_trainer_id);
