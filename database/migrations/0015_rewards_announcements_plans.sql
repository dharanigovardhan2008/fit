-- Opsyl Fit migration 0015: reward points, announcements, diet and workout plans, expiry reminders.
-- Run after 0014.

-- ============================================================
-- 1. Reward settings (owner can change these in Settings)
-- ============================================================
alter table gym add column if not exists points_per_visit   int     not null default 10;   -- points for each attended day
alter table gym add column if not exists point_value        numeric not null default 0.5;  -- rupees one point is worth
alter table gym add column if not exists streak_bonus       int     not null default 50;   -- extra points for each 7 days in a row
alter table gym add column if not exists max_discount_pct   int     not null default 30;   -- most of a plan price points can cover

create table if not exists points_redemption (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references gym(gym_id) on delete cascade,
  member_id  uuid not null references member(user_id) on delete cascade,
  points     int not null,
  amount     numeric(10, 2) not null,
  sub_id     uuid references subscription(sub_id) on delete set null,
  created_at timestamptz not null default now()
);
alter table points_redemption enable row level security;
drop policy if exists points_redemption_select on points_redemption;
create policy points_redemption_select on points_redemption for select using (
  gym_id = jwt_gym_id() and (jwt_role() in ('owner', 'trainer') or member_id = jwt_user_id())
);

-- ============================================================
-- 2. Points balance. Earned from attendance, so nothing else has to be kept in sync.
-- ============================================================
create or replace function member_points(p_member uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_gym uuid; g gym%rowtype;
  v_visits int; v_blocks int; v_earned int; v_redeemed int;
begin
  select gym_id into v_gym from member where user_id = p_member;
  if v_gym is null then return null; end if;
  if auth.uid() is not null and not (
    jwt_user_id() = p_member or (jwt_gym_id() = v_gym and jwt_role() in ('owner', 'trainer'))
  ) then
    raise exception 'not allowed';
  end if;
  select * into g from gym where gym_id = v_gym;

  select count(*) into v_visits from attendance where member_id = p_member and check_in is not null;

  -- every full 7 days in a row earns the streak bonus
  select coalesce(sum(len / 7), 0) into v_blocks from (
    select count(*) as len from (
      select attendance_date - (row_number() over (order by attendance_date))::int as grp
      from attendance where member_id = p_member and check_in is not null
    ) t group by grp
  ) r;

  v_earned := v_visits * g.points_per_visit + v_blocks * g.streak_bonus;
  select coalesce(sum(points), 0) into v_redeemed from points_redemption where member_id = p_member;

  return jsonb_build_object(
    'visits', v_visits, 'earned', v_earned, 'redeemed', v_redeemed,
    'balance', greatest(v_earned - v_redeemed, 0),
    'point_value', g.point_value, 'max_discount_pct', g.max_discount_pct,
    'points_per_visit', g.points_per_visit, 'streak_bonus', g.streak_bonus
  );
end $$;
grant execute on function member_points(uuid) to authenticated;

-- What a renewal costs, with or without points
create or replace function quote_renewal(p_member uuid, p_plan uuid, p_use_points boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_gym uuid; v_price numeric; v_pts jsonb; v_balance int; v_value numeric; v_pct int;
  v_disc numeric := 0; v_used int := 0;
begin
  select gym_id into v_gym from member where user_id = p_member;
  select price into v_price from plan where plan_id = p_plan and gym_id = v_gym;
  if v_price is null then raise exception 'Plan not found'; end if;
  v_pts := member_points(p_member);
  v_balance := (v_pts ->> 'balance')::int;
  v_value := (v_pts ->> 'point_value')::numeric;
  v_pct := (v_pts ->> 'max_discount_pct')::int;
  if p_use_points and v_balance > 0 and v_value > 0 then
    v_disc := floor(least(v_balance * v_value, v_price * v_pct / 100.0));
    v_used := least(v_balance, ceil(v_disc / v_value)::int);
  end if;
  return jsonb_build_object('price', v_price, 'discount', v_disc, 'points_used', v_used, 'payable', v_price - v_disc, 'balance', v_balance);
end $$;
grant execute on function quote_renewal(uuid, uuid, boolean) to authenticated;

-- Creates the new subscription and payment. Used by the owner and by the online payment function.
create or replace function complete_renewal(
  p_member uuid, p_plan uuid, p_use_points boolean, p_mode text, p_reference text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_gym uuid; v_days int; v_latest date; v_start date; v_end date; v_sub uuid; v_q jsonb; v_existing record;
begin
  if p_reference is not null then
    select p.payment_id, s.end_date into v_existing from payment p join subscription s on s.sub_id = p.sub_id where p.reference = p_reference limit 1;
    if found then return jsonb_build_object('ok', true, 'end_date', v_existing.end_date, 'duplicate', true); end if;
  end if;

  select gym_id into v_gym from member where user_id = p_member;
  select duration_days into v_days from plan where plan_id = p_plan and gym_id = v_gym;
  if v_days is null then raise exception 'Plan not found'; end if;

  v_q := quote_renewal(p_member, p_plan, p_use_points);
  select max(end_date) into v_latest from subscription where member_id = p_member;
  v_start := case when v_latest is not null and v_latest > current_date then v_latest else current_date end;
  v_end := v_start + v_days;

  insert into subscription (gym_id, member_id, plan_id, start_date, end_date, status)
    values (v_gym, p_member, p_plan, v_start, v_end, 'active') returning sub_id into v_sub;
  insert into payment (gym_id, sub_id, amount, mode, reference)
    values (v_gym, v_sub, (v_q ->> 'payable')::numeric, p_mode::payment_mode, coalesce(p_reference, 'RENEW-' || left(v_sub::text, 6)));
  if (v_q ->> 'points_used')::int > 0 then
    insert into points_redemption (gym_id, member_id, points, amount, sub_id)
      values (v_gym, p_member, (v_q ->> 'points_used')::int, (v_q ->> 'discount')::numeric, v_sub);
  end if;
  insert into notification (gym_id, user_id, type, message)
    values (v_gym, p_member, 'renewal', 'Your subscription was renewed until ' || to_char(v_end, 'DD Mon YYYY') || '. Keep going!');
  return jsonb_build_object('ok', true, 'end_date', v_end, 'paid', (v_q ->> 'payable')::numeric, 'discount', (v_q ->> 'discount')::numeric);
end $$;
revoke execute on function complete_renewal(uuid, uuid, boolean, text, text) from public, anon, authenticated;

-- Owner renews a member, optionally using the member's points
create or replace function owner_renew(p_member uuid, p_plan uuid, p_use_points boolean, p_mode text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if jwt_role() <> 'owner' or not exists (select 1 from member where user_id = p_member and gym_id = jwt_gym_id()) then
    raise exception 'not allowed';
  end if;
  return complete_renewal(p_member, p_plan, p_use_points, p_mode, null);
end $$;
grant execute on function owner_renew(uuid, uuid, boolean, text) to authenticated;

-- ============================================================
-- 3. Expiry reminders: motivation plus a nudge to renew (7, 3, 1 and 0 days). The push goes out
--    automatically because each reminder is a notification row.
-- ============================================================
create or replace function send_expiry_reminders() returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_left int; v_name text; v_pts int; v_msg text;
begin
  for r in
    select s.gym_id, s.member_id, s.end_date from subscription s
    where s.status = 'active' and (s.end_date - current_date) in (7, 3, 1, 0)
      and s.end_date = (select max(end_date) from subscription where member_id = s.member_id)
  loop
    v_left := r.end_date - current_date;
    select split_part(name, ' ', 1) into v_name from app_user where user_id = r.member_id;
    v_pts := coalesce((member_points(r.member_id) ->> 'balance')::int, 0);
    v_msg := case v_left
      when 7 then 'Hi ' || v_name || ', your plan ends in 7 days. You have shown up and put in the work, so do not let the momentum drop. Renew now and keep building!'
      when 3 then 'Hi ' || v_name || ', only 3 days left on your plan. Every session counts, and you are closer to your goal than you think. Renew today and stay on track!'
      when 1 then 'Hi ' || v_name || ', your plan ends tomorrow. Champions do not take breaks, they renew. Refill your plan and keep the streak alive!'
      else 'Hi ' || v_name || ', your plan ends today. Do not stop now, your best days are ahead. Renew today and keep going!'
    end;
    if v_pts > 0 then v_msg := v_msg || ' You have ' || v_pts || ' reward points to save on renewal.'; end if;
    insert into notification (gym_id, user_id, type, message) values (r.gym_id, r.member_id, 'expiry_reminder', v_msg);
  end loop;
end $$;

-- ============================================================
-- 4. Announcements from the owner
-- ============================================================
create table if not exists announcement (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references gym(gym_id) on delete cascade,
  title      text not null,
  message    text not null,
  audience   text not null default 'all' check (audience in ('all', 'members', 'trainers')),
  sent_to    int not null default 0,
  created_at timestamptz not null default now()
);
alter table announcement enable row level security;
drop policy if exists announcement_select on announcement;
create policy announcement_select on announcement for select using (gym_id = jwt_gym_id() and jwt_role() = 'owner');

create or replace function send_announcement(p_title text, p_message text, p_audience text) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if jwt_role() <> 'owner' then raise exception 'not allowed'; end if;
  if coalesce(trim(p_message), '') = '' then raise exception 'Write a message first'; end if;
  insert into notification (gym_id, user_id, type, message)
    select jwt_gym_id(), u.user_id, 'announcement',
      case when coalesce(trim(p_title), '') = '' then trim(p_message) else trim(p_title) || ': ' || trim(p_message) end
    from app_user u
    where u.gym_id = jwt_gym_id() and u.is_active
      and ((p_audience in ('all', 'members') and u.role = 'member') or (p_audience in ('all', 'trainers') and u.role = 'trainer'));
  get diagnostics v_count = row_count;
  insert into announcement (gym_id, title, message, audience, sent_to)
    values (jwt_gym_id(), coalesce(trim(p_title), ''), trim(p_message), p_audience, v_count);
  return v_count;
end $$;
grant execute on function send_announcement(text, text, text) to authenticated;

-- ============================================================
-- 5. Diet and workout plans
-- ============================================================
create table if not exists member_plan (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references gym(gym_id) on delete cascade,
  member_id  uuid not null references member(user_id) on delete cascade,
  created_by uuid references app_user(user_id) on delete set null,
  kind       text not null check (kind in ('diet', 'workout')),
  title      text not null,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists member_plan_member on member_plan(member_id);

create table if not exists member_plan_log (
  id        uuid primary key default gen_random_uuid(),
  gym_id    uuid not null references gym(gym_id) on delete cascade,
  plan_id   uuid not null references member_plan(id) on delete cascade,
  member_id uuid not null references member(user_id) on delete cascade,
  log_date  date not null default current_date,
  unique (plan_id, log_date)
);

alter table member_plan enable row level security;
alter table member_plan_log enable row level security;

drop policy if exists member_plan_read on member_plan;
create policy member_plan_read on member_plan for select using (
  gym_id = jwt_gym_id() and (
    jwt_role() = 'owner' or member_id = jwt_user_id()
    or (jwt_role() = 'trainer' and member_id in (select user_id from member where assigned_trainer_id = jwt_user_id()))
  )
);
drop policy if exists member_plan_write on member_plan;
create policy member_plan_write on member_plan for all using (
  gym_id = jwt_gym_id() and (
    jwt_role() = 'owner'
    or (jwt_role() = 'trainer' and member_id in (select user_id from member where assigned_trainer_id = jwt_user_id()))
  )
) with check (
  gym_id = jwt_gym_id() and (
    jwt_role() = 'owner'
    or (jwt_role() = 'trainer' and member_id in (select user_id from member where assigned_trainer_id = jwt_user_id()))
  )
);

drop policy if exists member_plan_log_read on member_plan_log;
create policy member_plan_log_read on member_plan_log for select using (
  gym_id = jwt_gym_id() and (
    jwt_role() in ('owner', 'trainer') or member_id = jwt_user_id()
  )
);
drop policy if exists member_plan_log_self on member_plan_log;
create policy member_plan_log_self on member_plan_log for all using (
  gym_id = jwt_gym_id() and member_id = jwt_user_id()
) with check (
  gym_id = jwt_gym_id() and member_id = jwt_user_id()
);

-- Tell the member when a new plan is assigned
create or replace function notify_plan_assigned() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notification (gym_id, user_id, type, message)
    values (new.gym_id, new.member_id, 'plan_assigned',
      'New ' || new.kind || ' plan for you: ' || new.title || '. Open My Plans to see it.');
  return new;
end $$;
drop trigger if exists member_plan_notify on member_plan;
create trigger member_plan_notify after insert on member_plan for each row execute function notify_plan_assigned();
