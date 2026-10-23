-- GymSphere migration 0009: approval-based attendance and Google login support

-- ============================================================
-- 1. Extend enums
-- ============================================================

do $$ begin
  alter type attend_method add value if not exists 'gps_only';
exception when others then null; end $$;

do $$ begin
  alter type request_status add value if not exists 'expired';
exception when others then null; end $$;

-- ============================================================
-- 2. Gym setting: require_checkout_approval
-- ============================================================

alter table gym
  add column if not exists require_checkout_approval boolean not null default false;

-- ============================================================
-- 3. Table: attendance_request
-- ============================================================

create table if not exists attendance_request (
  request_id    uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references gym(gym_id) on delete cascade,
  member_id     uuid not null references member(user_id) on delete cascade,
  trainer_id    uuid references trainer(user_id),          -- assigned trainer at request time
  method        attend_method not null default 'qr_gps',   -- qr_gps or gps_only
  requested_at  timestamptz not null default now(),
  latitude      double precision,
  longitude     double precision,
  accuracy_m    double precision,
  distance_m    double precision,
  status        request_status not null default 'pending',
  decided_by    uuid references app_user(user_id),
  decided_at    timestamptz,
  reject_reason text,
  att_id        uuid references attendance(att_id)         -- filled on approval
);

create index if not exists idx_att_req_gym_member on attendance_request(gym_id, member_id);
create index if not exists idx_att_req_status on attendance_request(gym_id, status, requested_at);

-- Uniqueness: only one pending request per member per day
create unique index if not exists uq_att_req_member_pending
  on attendance_request(member_id, ((requested_at at time zone 'UTC')::date))
  where status = 'pending';

-- ============================================================
-- 4. RLS: attendance_request
-- ============================================================

alter table attendance_request enable row level security;

-- owner sees all requests for their gym
create policy att_req_owner on attendance_request for all using (
  gym_id = jwt_gym_id() and jwt_role() = 'owner'
);

-- trainer sees only their own members' requests
create policy att_req_trainer on attendance_request for select using (
  gym_id = jwt_gym_id()
  and jwt_role() = 'trainer'
  and trainer_id = jwt_user_id()
);
create policy att_req_trainer_decide on attendance_request for update using (
  gym_id = jwt_gym_id()
  and jwt_role() = 'trainer'
  and trainer_id = jwt_user_id()
);

-- member sees only their own requests
create policy att_req_member_select on attendance_request for select using (
  gym_id = jwt_gym_id() and member_id = jwt_user_id()
);
create policy att_req_member_insert on attendance_request for insert with check (
  gym_id = jwt_gym_id() and member_id = jwt_user_id()
);

-- ============================================================
-- 5. Function: create_attendance_request
-- ============================================================

create or replace function create_attendance_request(
  p_member   uuid,
  p_method   attend_method,  -- 'qr_gps' or 'gps_only'
  p_lat      double precision,
  p_lng      double precision,
  p_accuracy double precision
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_gym_id    uuid;
  v_glat      double precision;
  v_glng      double precision;
  v_radius    int;
  v_closing   time;
  v_dist      double precision;
  v_has_sub   boolean;
  v_today     date := current_date;
  v_trainer   uuid;
  v_owner_id  uuid;
  v_req_id    uuid;
  v_count_today int;
  v_existing  attendance_request%rowtype;
begin
  -- Resolve gym
  select m.gym_id, m.assigned_trainer_id
    into v_gym_id, v_trainer
    from member m where m.user_id = p_member;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Member not found');
  end if;

  select g.latitude, g.longitude, g.radius_m, g.closing_time
    into v_glat, v_glng, v_radius, v_closing
    from gym g where g.gym_id = v_gym_id;

  -- Active subscription check
  select exists(
    select 1 from subscription
    where member_id = p_member and status = 'active' and end_date >= v_today
  ) into v_has_sub;

  if not v_has_sub then
    return jsonb_build_object('ok', false, 'error', 'No active subscription');
  end if;

  -- Already approved today?
  if exists(
    select 1 from attendance where member_id = p_member and attendance_date = v_today and check_in is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'Already present today');
  end if;

  -- Already a pending request today?
  select * into v_existing from attendance_request
    where member_id = p_member and requested_at::date = v_today and status = 'pending';
  if found then
    return jsonb_build_object('ok', false, 'error', 'A request is already pending approval');
  end if;

  -- Daily request limit (3 per day including rejected/expired)
  select count(*) into v_count_today
    from attendance_request
    where member_id = p_member and requested_at::date = v_today;
  if v_count_today >= 3 then
    return jsonb_build_object('ok', false, 'error', 'Daily request limit reached (3 per day)');
  end if;

  -- GPS accuracy check
  if p_accuracy is not null and p_accuracy > 80 then
    return jsonb_build_object('ok', false, 'error', 'Location accuracy is too low. Move outdoors and try again.');
  end if;

  -- Distance check
  if v_glat is not null and p_lat is not null then
    v_dist := distance_m(v_glat, v_glng, p_lat, p_lng);
    if v_dist > v_radius then
      return jsonb_build_object('ok', false, 'error', 'You are too far from the gym');
    end if;
  end if;

  -- Insert the pending request
  insert into attendance_request (
    gym_id, member_id, trainer_id, method, latitude, longitude, accuracy_m, distance_m, status
  ) values (
    v_gym_id, p_member, v_trainer, p_method, p_lat, p_lng, p_accuracy, v_dist, 'pending'
  ) returning request_id into v_req_id;

  -- Notify assigned trainer and owner
  select user_id into v_owner_id
    from app_user where gym_id = v_gym_id and role = 'owner' limit 1;

  if v_trainer is not null then
    insert into notification (gym_id, user_id, type, message)
      values (v_gym_id, v_trainer, 'attendance_requested',
        (select name from app_user where user_id = p_member) || ' has requested attendance approval.');
  end if;

  if v_owner_id is not null then
    insert into notification (gym_id, user_id, type, message)
      values (v_gym_id, v_owner_id, 'attendance_requested',
        (select name from app_user where user_id = p_member) || ' has requested attendance approval.');
  end if;

  -- Audit event
  insert into event (gym_id, type, actor_id, payload)
    values (v_gym_id, 'attendance_requested', p_member,
      jsonb_build_object('request_id', v_req_id, 'method', p_method, 'distance_m', v_dist));

  return jsonb_build_object('ok', true, 'request_id', v_req_id);
end;
$$;

-- ============================================================
-- 6. Function: decide_attendance_request
-- ============================================================

create or replace function decide_attendance_request(
  p_request_id uuid,
  p_decision   text,      -- 'approved' or 'rejected'
  p_decider    uuid,
  p_reason     text default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_req     attendance_request%rowtype;
  v_decider_role text;
  v_att_id  uuid;
  v_rows    int;
begin
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'Decision must be approved or rejected');
  end if;

  -- Verify decider role
  select role into v_decider_role from app_user where user_id = p_decider;

  -- Atomic status guard: only acts on pending, first decision wins
  update attendance_request
    set status      = p_decision::request_status,
        decided_by  = p_decider,
        decided_at  = now(),
        reject_reason = case when p_decision = 'rejected' then p_reason else null end
    where request_id = p_request_id
      and status = 'pending'
      and (
        -- owner can decide for anyone in the gym
        (v_decider_role = 'owner' and gym_id = (
          select gym_id from app_user where user_id = p_decider
        ))
        or
        -- trainer can decide only for their own members
        (v_decider_role = 'trainer' and trainer_id = p_decider)
      )
  returning request_id, gym_id, member_id, method, requested_at, latitude, longitude, accuracy_m, distance_m
    into v_req.request_id, v_req.gym_id, v_req.member_id, v_req.method,
         v_req.requested_at, v_req.latitude, v_req.longitude, v_req.accuracy_m, v_req.distance_m;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    -- Check if it was already decided by someone else
    select * into v_req from attendance_request where request_id = p_request_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'Request not found');
    end if;
    if v_req.status <> 'pending' then
      return jsonb_build_object('ok', false, 'error', 'This request was already decided');
    end if;
    return jsonb_build_object('ok', false, 'error', 'You do not have permission to decide this request');
  end if;

  -- On approval: create the attendance row
  if p_decision = 'approved' then
    insert into attendance (gym_id, member_id, attendance_date, check_in, in_method, distance_m)
      values (v_req.gym_id, v_req.member_id, v_req.requested_at::date,
              v_req.requested_at, v_req.method, v_req.distance_m)
      returning att_id into v_att_id;

    update attendance_request set att_id = v_att_id where request_id = p_request_id;

    -- Notify member
    insert into notification (gym_id, user_id, type, message)
      values (v_req.gym_id, v_req.member_id, 'attendance_approved',
        'Your attendance has been approved. You are marked present.');

    -- Audit event
    insert into event (gym_id, type, actor_id, payload)
      values (v_req.gym_id, 'attendance_approved', p_decider,
        jsonb_build_object('request_id', p_request_id, 'member_id', v_req.member_id, 'att_id', v_att_id));
  else
    -- Notify member of rejection
    insert into notification (gym_id, user_id, type, message)
      values (v_req.gym_id, v_req.member_id, 'attendance_rejected',
        case when p_reason is not null and p_reason <> ''
          then 'Your attendance request was not approved: ' || p_reason
          else 'Your attendance request was not approved.'
        end);

    insert into event (gym_id, type, actor_id, payload)
      values (v_req.gym_id, 'attendance_rejected', p_decider,
        jsonb_build_object('request_id', p_request_id, 'member_id', v_req.member_id, 'reason', p_reason));
  end if;

  return jsonb_build_object('ok', true, 'att_id', v_att_id);
end;
$$;

-- ============================================================
-- 7. pg_cron: expire pending requests at gym closing time
-- ============================================================

create or replace function expire_attendance_requests()
returns void
language plpgsql as $$
begin
  -- Expire any pending request where the gym's closing time for today has passed
  update attendance_request ar
    set status = 'expired'
  from gym g
  where ar.gym_id = g.gym_id
    and ar.status = 'pending'
    and ar.requested_at::date = current_date
    and now() >= (current_date + g.closing_time)::timestamptz;
end;
$$;

-- Run every 15 minutes alongside auto-close
select cron.schedule(
  'gymsphere-expire-att-requests',
  '*/15 * * * *',
  $$select expire_attendance_requests();$$
);

-- ============================================================
-- 8. Updated views: count approved attendance only
-- ============================================================

create or replace view v_member_features as
select
  m.user_id as member_id,
  m.gym_id,
  count(a.*) filter (where a.attendance_date >= current_date - interval '7 days'
                       and a.check_in is not null) as visits_7d,
  count(a.*) filter (where a.attendance_date >= current_date - interval '30 days'
                       and a.check_in is not null) as visits_30d,
  count(a.*) filter (where a.attendance_date >= current_date - interval '60 days'
                       and a.attendance_date < current_date - interval '30 days'
                       and a.check_in is not null) as visits_prev_30d,
  (current_date - max(a.attendance_date) filter (where a.check_in is not null)) as days_since_last_visit,
  (select min(s.end_date) - current_date from subscription s
     where s.member_id = m.user_id and s.status = 'active') as days_to_expiry,
  (select avg(r.score) from rating r where r.member_id = m.user_id) as avg_rating_given,
  (current_date - m.joined_on) as tenure_days
from member m
left join attendance a on a.member_id = m.user_id
group by m.user_id, m.gym_id, m.joined_on;

create or replace view v_daily_attendance as
select gym_id, attendance_date as date, extract(hour from check_in)::int as hour, count(*) as visits
from attendance
where check_in is not null
group by gym_id, attendance_date, extract(hour from check_in);

-- ============================================================
-- 9. Custom Access Token Hook for Google login
--    Place this in Supabase Dashboard > Authentication > Hooks > Custom Access Token Hook
--    Then enable it. The function name is gymsphere_custom_access_token_hook.
-- ============================================================

create or replace function gymsphere_custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_user_id   uuid;
  v_gym_id    uuid;
  v_role      text;
  v_public_id text;
  v_claims    jsonb;
begin
  -- Look up the app_user row for the Supabase auth user
  select u.user_id, u.gym_id, u.role::text, u.public_id
    into v_user_id, v_gym_id, v_role, v_public_id
    from app_user u
    where u.auth_id = (event ->> 'user_id')::uuid
    limit 1;

  -- Start from whatever claims Supabase already prepared
  v_claims := coalesce(event -> 'claims', '{}'::jsonb);

  if v_user_id is not null then
    -- Merge GymSphere-specific claims into app_metadata
    v_claims := jsonb_set(v_claims, '{app_metadata}',
      coalesce(v_claims -> 'app_metadata', '{}'::jsonb) ||
      jsonb_build_object(
        'gym_id',    v_gym_id,
        'role',      v_role,
        'public_id', v_public_id
      )
    );
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- Grant execute to the supabase_auth_admin role (required by Supabase hook system)
grant execute on function gymsphere_custom_access_token_hook(jsonb)
  to supabase_auth_admin;
revoke execute on function gymsphere_custom_access_token_hook(jsonb)
  from public, anon, authenticated;

