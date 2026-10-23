-- GymSphere migration 0010: security fixes and gaps found while connecting the app to Supabase
-- Safe to run once, after 0009.

-- ============================================================
-- 0. Fix: jwt_user_id() looked up app_user while app_user's own row level security policy called
--    jwt_user_id(), which recursed until Postgres gave up ("infinite recursion" / stack depth
--    errors on every query). Running it as the function owner breaks the loop.
-- ============================================================
create or replace function jwt_user_id() returns uuid
language sql stable security definer
set search_path = public
as $$
  select user_id from app_user where auth_id = auth.uid()
$$;

-- ============================================================
-- 1. change_request: record who submitted it, allow trainer suggestions
-- ============================================================
alter table change_request add column if not exists submitted_by text not null default 'member';

-- A trainer's "new member suggestion" stores the trainer's own id in member_id, so the
-- foreign key to member cannot stay.
alter table change_request drop constraint if exists change_request_member_id_fkey;

-- ============================================================
-- 2. Notifications: owners and trainers may create them (renewals, trainer assignment)
-- ============================================================
drop policy if exists notification_insert_staff on notification;
create policy notification_insert_staff on notification for insert with check (
  gym_id = jwt_gym_id() and jwt_role() in ('owner', 'trainer')
);

-- ============================================================
-- 3. Members can see their own assigned trainer
-- ============================================================
drop policy if exists app_user_select_my_trainer on app_user;
create policy app_user_select_my_trainer on app_user for select using (
  gym_id = jwt_gym_id()
  and user_id in (select m.assigned_trainer_id from member m where m.user_id = jwt_user_id())
);

drop policy if exists trainer_select_mine on trainer;
create policy trainer_select_mine on trainer for select using (
  gym_id = jwt_gym_id()
  and user_id in (select m.assigned_trainer_id from member m where m.user_id = jwt_user_id())
);

-- ============================================================
-- 4. Attendance can only be created through the approval flow
--    Members could previously insert and edit their own attendance directly, which skipped
--    QR, GPS and approval. Those writes now happen only in SQL functions and Edge Functions.
-- ============================================================
drop policy if exists attendance_write_self on attendance;
drop policy if exists attendance_update_self on attendance;

-- Trainers may add a manual check-in for their own members.
drop policy if exists attendance_insert_trainer on attendance;
create policy attendance_insert_trainer on attendance for insert with check (
  gym_id = jwt_gym_id() and jwt_role() = 'trainer' and member_id in (
    select user_id from member where assigned_trainer_id = jwt_user_id()
  )
);

-- ============================================================
-- 5. The attendance audit trigger must be able to write the audit row
-- ============================================================
create or replace function audit_attendance_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.check_in is distinct from new.check_in) or (old.check_out is distinct from new.check_out) then
    insert into attendance_audit (gym_id, att_id, changed_by, old_values, new_values)
    values (
      new.gym_id, new.att_id, new.edited_by,
      jsonb_build_object('check_in', old.check_in, 'check_out', old.check_out),
      jsonb_build_object('check_in', new.check_in, 'check_out', new.check_out)
    );
  end if;
  return new;
end;
$$;

-- ============================================================
-- 6. Stop people editing fields they must not control
-- ============================================================
create or replace function guard_app_user_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then
    return new;  -- service role (Edge Functions, SQL jobs)
  end if;
  if new.gym_id is distinct from old.gym_id
     or new.role is distinct from old.role
     or new.public_id is distinct from old.public_id
     or new.auth_id is distinct from old.auth_id
     or new.email is distinct from old.email then
    raise exception 'You do not have permission to change that.';
  end if;
  if jwt_role() <> 'owner' and (
       new.is_active is distinct from old.is_active
       or new.failed_attempts is distinct from old.failed_attempts
       or new.locked_until is distinct from old.locked_until) then
    raise exception 'You do not have permission to change that.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_app_user on app_user;
create trigger trg_guard_app_user before update on app_user
  for each row execute function guard_app_user_update();

create or replace function guard_member_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and jwt_role() <> 'owner' and (
       new.gym_id is distinct from old.gym_id
       or new.assigned_trainer_id is distinct from old.assigned_trainer_id
       or new.waitlisted is distinct from old.waitlisted
       or new.joined_on is distinct from old.joined_on) then
    raise exception 'You do not have permission to change that.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_member on member;
create trigger trg_guard_member before update on member
  for each row execute function guard_member_update();

-- ============================================================
-- 7. Attendance functions: lock down who may call them
-- ============================================================
-- decide_attendance_request now takes the decider from the caller's token instead of trusting
-- the p_decider argument.
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
  -- Never trust the caller-supplied id when a signed-in user is calling: use the id from their token.
  if auth.uid() is not null then
    p_decider := jwt_user_id();
  end if;

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

-- Only the Edge Functions (service role) may create requests or record attendance directly.
revoke execute on function create_attendance_request(uuid, attend_method, double precision, double precision, double precision)
  from public, anon, authenticated;
revoke execute on function record_attendance(uuid, text, double precision, double precision, attend_method)
  from public, anon, authenticated;
revoke execute on function decide_attendance_request(uuid, text, uuid, text) from public, anon;

-- ============================================================
-- 8. Member asks for account deletion (members cannot read the owner's row)
-- ============================================================
create or replace function request_account_deletion() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user app_user%rowtype;
begin
  select * into v_user from app_user where auth_id = auth.uid();
  if not found then
    raise exception 'You do not have permission to do this.';
  end if;
  insert into notification (gym_id, user_id, type, message)
  select v_user.gym_id, o.user_id, 'deletion_request',
         v_user.name || ' (' || v_user.public_id || ') requested account deletion.'
  from app_user o
  where o.gym_id = v_user.gym_id and o.role = 'owner';
end;
$$;

revoke execute on function request_account_deletion() from public, anon;
grant execute on function request_account_deletion() to authenticated;
