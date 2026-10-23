-- GymSphere migration 0013: several gyms per owner, gym list for login, trainer attendance
-- Run after 0012. Replaces the one-gym rule from 0012.

-- ============================================================
-- 1. Several gyms, one sign-in per owner
--    An owner has one Auth account and one app_user row per gym.
-- ============================================================
drop index if exists one_gym_only;

alter table app_user drop constraint if exists app_user_email_key;
alter table app_user drop constraint if exists app_user_auth_id_key;
alter table app_user drop constraint if exists app_user_gym_email_key;
alter table app_user drop constraint if exists app_user_auth_gym_key;
alter table app_user add constraint app_user_gym_email_key unique (gym_id, email);
alter table app_user add constraint app_user_auth_gym_key unique (auth_id, gym_id);

-- The active gym is stored in the sign-in token (app_metadata.gym_id), so the signed-in row is
-- the one that belongs to that gym.
create or replace function jwt_user_id() returns uuid
language sql stable security definer
set search_path = public
as $$
  select user_id from app_user where auth_id = auth.uid() and gym_id = jwt_gym_id() limit 1
$$;

-- Gyms listed on the login screen (names only).
create or replace function public_gyms() returns table (gym_id uuid, name text)
language sql stable security definer
set search_path = public
as $$
  select g.gym_id, g.name from gym g order by lower(g.name)
$$;
grant execute on function public_gyms() to anon, authenticated;

-- Gyms the signed-in person can switch between.
create or replace function my_gyms() returns table (gym_id uuid, name text, role user_role)
language sql stable security definer
set search_path = public
as $$
  select g.gym_id, g.name, u.role
  from app_user u join gym g on g.gym_id = u.gym_id
  where u.auth_id = auth.uid() and u.is_active
  order by g.created_at
$$;
revoke execute on function my_gyms() from public, anon;
grant execute on function my_gyms() to authenticated;

-- Google sign-in hook: keep the gym already chosen instead of picking one at random.
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
  v_current   uuid;
begin
  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_current := nullif(v_claims -> 'app_metadata' ->> 'gym_id', '')::uuid;

  select u.user_id, u.gym_id, u.role::text, u.public_id
    into v_user_id, v_gym_id, v_role, v_public_id
    from app_user u
    where u.auth_id = (event ->> 'user_id')::uuid
    order by (u.gym_id = v_current) desc nulls last, u.created_at
    limit 1;

  if v_user_id is not null then
    v_claims := jsonb_set(v_claims, '{app_metadata}',
      coalesce(v_claims -> 'app_metadata', '{}'::jsonb) ||
      jsonb_build_object('gym_id', v_gym_id, 'role', v_role, 'public_id', v_public_id)
    );
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;
grant execute on function gymsphere_custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function gymsphere_custom_access_token_hook(jsonb) from public, anon, authenticated;

-- ============================================================
-- 2. Trainer attendance (the trainer's own check-in, approved by the owner)
-- ============================================================
create table if not exists trainer_attendance (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references gym(gym_id) on delete cascade,
  trainer_id      uuid not null references trainer(user_id) on delete cascade,
  attendance_date date not null default current_date,
  check_in        timestamptz,
  check_out       timestamptz,
  status          request_status not null default 'pending',
  method          text not null default 'self',          -- 'self' or 'manual'
  latitude        double precision,
  longitude       double precision,
  distance_m      double precision,
  decided_by      uuid references app_user(user_id),
  decided_at      timestamptz,
  reject_reason   text,
  unique (trainer_id, attendance_date),
  check (check_out is null or check_in is null or check_out > check_in)
);

create index if not exists idx_trainer_att_gym_date on trainer_attendance(gym_id, attendance_date);

alter table trainer_attendance enable row level security;

drop policy if exists trainer_att_owner on trainer_attendance;
create policy trainer_att_owner on trainer_attendance for all using (
  gym_id = jwt_gym_id() and jwt_role() = 'owner'
);
drop policy if exists trainer_att_self on trainer_attendance;
create policy trainer_att_self on trainer_attendance for select using (
  gym_id = jwt_gym_id() and trainer_id = jwt_user_id()
);

-- Trainer asks for today's check-in. The owner is notified to approve it.
create or replace function trainer_check_in(
  p_lat double precision, p_lng double precision, p_accuracy double precision
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_trainer uuid := jwt_user_id();
  v_gym uuid := jwt_gym_id();
  v_glat double precision; v_glng double precision; v_radius int;
  v_dist double precision;
  v_existing trainer_attendance%rowtype;
  v_name text;
begin
  if v_trainer is null or jwt_role() <> 'trainer' then
    return jsonb_build_object('ok', false, 'error', 'Only trainers can do this');
  end if;

  select * into v_existing from trainer_attendance where trainer_id = v_trainer and attendance_date = current_date;
  if found then
    if v_existing.status = 'rejected' then
      return jsonb_build_object('ok', false, 'error', 'Your attendance for today was not approved');
    end if;
    return jsonb_build_object('ok', false, 'error', 'You already checked in today');
  end if;

  if p_accuracy is not null and p_accuracy > 80 then
    return jsonb_build_object('ok', false, 'error', 'Location accuracy is too low. Move outdoors and try again.');
  end if;

  select latitude, longitude, radius_m into v_glat, v_glng, v_radius from gym where gym_id = v_gym;
  if v_glat is not null and v_glng is not null and p_lat is not null and p_lng is not null then
    v_dist := distance_m(v_glat, v_glng, p_lat, p_lng);
    if v_dist > v_radius then
      return jsonb_build_object('ok', false, 'error', 'You are too far from the gym');
    end if;
  end if;

  insert into trainer_attendance (gym_id, trainer_id, check_in, status, method, latitude, longitude, distance_m)
    values (v_gym, v_trainer, now(), 'pending', 'self', p_lat, p_lng, v_dist);

  select name into v_name from app_user where user_id = v_trainer;
  insert into notification (gym_id, user_id, type, message)
    select v_gym, o.user_id, 'trainer_attendance_requested', v_name || ' has requested attendance approval.'
    from app_user o where o.gym_id = v_gym and o.role = 'owner';

  return jsonb_build_object('ok', true);
end;
$$;

-- Trainer ends the day.
create or replace function trainer_check_out() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_trainer uuid := jwt_user_id();
  v_row trainer_attendance%rowtype;
begin
  if v_trainer is null or jwt_role() <> 'trainer' then
    return jsonb_build_object('ok', false, 'error', 'Only trainers can do this');
  end if;
  select * into v_row from trainer_attendance where trainer_id = v_trainer and attendance_date = current_date;
  if not found or v_row.check_in is null then
    return jsonb_build_object('ok', false, 'error', 'You have not checked in today');
  end if;
  if v_row.check_out is not null then
    return jsonb_build_object('ok', false, 'error', 'You already checked out today');
  end if;
  update trainer_attendance set check_out = now() where id = v_row.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Owner approves or rejects a trainer's day.
create or replace function decide_trainer_attendance(p_id uuid, p_decision text, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid := jwt_user_id();
  v_row trainer_attendance%rowtype;
begin
  if v_owner is null or jwt_role() <> 'owner' then
    return jsonb_build_object('ok', false, 'error', 'Only the owner can decide this');
  end if;
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'Decision must be approved or rejected');
  end if;

  update trainer_attendance
    set status = p_decision::request_status, decided_by = v_owner, decided_at = now(),
        reject_reason = case when p_decision = 'rejected' then p_reason else null end
    where id = p_id and gym_id = jwt_gym_id() and status = 'pending'
    returning * into v_row;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'This request was already decided or does not exist');
  end if;

  insert into notification (gym_id, user_id, type, message)
    values (v_row.gym_id, v_row.trainer_id,
            case p_decision when 'approved' then 'attendance_approved' else 'attendance_rejected' end,
            case p_decision when 'approved' then 'Your attendance has been approved.'
                 else 'Your attendance was not approved' || coalesce(': ' || nullif(p_reason, ''), '.') end);
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function trainer_check_in(double precision, double precision, double precision) from public, anon;
revoke execute on function trainer_check_out() from public, anon;
revoke execute on function decide_trainer_attendance(uuid, text, text) from public, anon;

-- ============================================================
-- 3. remove_person also clears trainer attendance decisions
-- ============================================================
create or replace function remove_person(p_user uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update member set assigned_trainer_id = null where assigned_trainer_id = p_user;
  delete from rating where trainer_id = p_user and equipment_id is null;
  update rating set trainer_id = null where trainer_id = p_user;
  update change_request set from_trainer = null where from_trainer = p_user;
  update change_request set to_trainer = null where to_trainer = p_user;
  update change_request set decided_by = null where decided_by = p_user;
  delete from change_request where member_id = p_user;
  update attendance_request set trainer_id = null where trainer_id = p_user;
  update attendance_request set decided_by = null where decided_by = p_user;
  update trainer_attendance set decided_by = null where decided_by = p_user;
  update attendance set edited_by = null where edited_by = p_user;
  update attendance_audit set changed_by = null where changed_by = p_user;
  update event set actor_id = null where actor_id = p_user;
  delete from app_user where user_id = p_user;
end;
$$;
revoke execute on function remove_person(uuid) from public, anon, authenticated;
