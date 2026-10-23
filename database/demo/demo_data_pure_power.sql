-- GymSphere demo data: "Pure Power"
-- Run in the Supabase SQL Editor AFTER migrations 0001 to 0013.
-- Creates one gym with an owner, 4 trainers and 40 members, plus 90 days of attendance, payments,
-- subscriptions, ratings, equipment, salaries, requests and alerts, so every screen has data.
--
-- LOGIN (pick "Pure Power" in the Gym dropdown):
--   Owner    ID O2601   (or owner@purepower.test or 9000000001)   password Demo@1234
--   Trainer  ID T2601   password Demo@1234   (T2602, T2603, T2604 too)
--   Member   ID M2601   password Demo@1234   (M2602 ... M2640 too)
--
-- To remove the demo later, use Settings -> Delete gym while signed in as the owner,
-- then run the CLEANUP lines at the bottom of this file.

do $demo$
declare
  v_gym_name     constant text := 'Pure Power';
  v_gym_address  constant text := 'Pure Power, MG Road, Hyderabad';   -- change this if you like
  v_password     constant text := 'Demo@1234';
  v_gym          uuid;
  v_today        date := current_date;
  v_owner        uuid;
  v_plan_m uuid; v_plan_q uuid; v_plan_y uuid;
  v_plan_ids     uuid[];
  v_plan_days    int[] := array[30, 90, 365];
  v_plan_prices  numeric[] := array[1500, 4000, 14000];
  t_names   text[] := array['Ravi Teja', 'Sneha Reddy', 'Arjun Varma', 'Kavya Nair'];
  t_special text[] := array['Strength Training', 'Weight Loss', 'Yoga and Mobility', 'Cardio and Endurance'];
  t_shifts  shift_type[] := array['morning', 'evening', 'full', 'morning']::shift_type[];
  m_first   text[] := array['Aarav','Vivaan','Aditya','Sai','Rohan','Karthik','Vikram','Arjun','Rahul','Siddharth',
                            'Ananya','Priya','Divya','Sneha','Meera','Lakshmi','Pooja','Nisha','Kavya','Isha'];
  m_last    text[] := array['Sharma','Reddy','Naidu','Kumar','Rao','Patel','Iyer','Gupta','Verma','Singh'];
  goals     text[] := array['lose weight and improve stamina', 'build muscle and strength training',
                            'general fitness and mobility', 'weight loss and toning',
                            'strength training for sport', 'yoga and mobility for recovery'];
  equip_names  text[] := array['Treadmill 1','Treadmill 2','Treadmill 3','Elliptical 1','Rowing Machine','Squat Rack',
                               'Bench Press','Cable Cross','Leg Press','Dumbbell Set','Spin Bike 1','Spin Bike 2'];
  equip_scores numeric[] := array[4.5,4.0,2.6,4.8,4.1,4.9,4.6,3.9,4.3,4.7,2.8,4.2];
  v_equip_ids uuid[] := '{}';
  v_trainer_ids uuid[] := '{}';
  v_member_ids uuid[] := '{}';
  v_uid uuid; v_auth uuid; v_pub text; v_email text; v_name text;
  i int; d int; k int;
  v_join date; v_motivation numeric; v_shift shift_type; v_plan int; v_cycle_start date; v_cycle_end date;
  v_sub uuid; v_rate numeric; v_hour int; v_in timestamptz; v_out timestamptz; v_trainer uuid;
  v_days30 int; v_idle boolean;
begin
  if exists (select 1 from gym where code = 'PWR001') then
    raise notice 'The Pure Power demo gym already exists. Delete it first (see the CLEANUP lines at the bottom).';
    return;
  end if;

  perform setseed(0.42);
  alter table rating disable trigger trg_rating_eligibility;

  -- ---------- gym and plans ----------
  insert into gym (code, name, address, latitude, longitude, radius_m, closing_time)
    values ('PWR001', v_gym_name, v_gym_address, 17.4326, 78.4071, 120, '22:00')
    returning gym_id into v_gym;

  insert into plan (gym_id, name, duration_days, price) values (v_gym, 'Monthly', 30, 1500) returning plan_id into v_plan_m;
  insert into plan (gym_id, name, duration_days, price) values (v_gym, 'Quarterly', 90, 4000) returning plan_id into v_plan_q;
  insert into plan (gym_id, name, duration_days, price) values (v_gym, 'Yearly', 365, 14000) returning plan_id into v_plan_y;
  v_plan_ids := array[v_plan_m, v_plan_q, v_plan_y];

  -- ---------- owner ----------
  v_auth := gen_random_uuid();
  v_email := 'owner@purepower.test';
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
                          raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
                          email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_auth, 'authenticated', 'authenticated', v_email,
            crypt(v_password, gen_salt('bf')), now(),
            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'gym_id', v_gym, 'role', 'owner'),
            '{}'::jsonb, now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_auth, v_auth::text, jsonb_build_object('sub', v_auth::text, 'email', v_email), 'email', now(), now(), now());
  v_pub := next_public_id(v_gym, 'owner');
  insert into app_user (auth_id, gym_id, public_id, role, name, age, gender, phone, email, must_change_password)
    values (v_auth, v_gym, v_pub, 'owner', 'Pure Power Owner', 38, 'male', '9000000001', v_email, false)
    returning user_id into v_owner;

  -- ---------- trainers ----------
  for i in 1..4 loop
    v_auth := gen_random_uuid();
    v_email := 'trainer' || i || '@purepower.test';
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
                            raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
                            email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', v_auth, 'authenticated', 'authenticated', v_email,
              crypt(v_password, gen_salt('bf')), now(),
              jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'gym_id', v_gym, 'role', 'trainer'),
              '{}'::jsonb, now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_auth, v_auth::text, jsonb_build_object('sub', v_auth::text, 'email', v_email), 'email', now(), now(), now());
    v_pub := next_public_id(v_gym, 'trainer');
    insert into app_user (auth_id, gym_id, public_id, role, name, age, gender, phone, email, must_change_password)
      values (v_auth, v_gym, v_pub, 'trainer', t_names[i], 26 + i * 3, case when i % 2 = 1 then 'male' else 'female' end::gender_type,
              '90000000' || (10 + i), v_email, false)
      returning user_id into v_uid;
    insert into trainer (user_id, gym_id, salary, specialty, shift, max_capacity, joined_on)
      values (v_uid, v_gym, 26000 + i * 3000, t_special[i], t_shifts[i], 14, v_today - (320 - i * 40));
    v_trainer_ids := v_trainer_ids || v_uid;
  end loop;

  -- ---------- equipment ----------
  for i in 1..12 loop
    insert into equipment (gym_id, name, condition_score, last_serviced)
      values (v_gym, equip_names[i], equip_scores[i], v_today - floor(random() * 120)::int)
      returning equipment_id into v_uid;
    v_equip_ids := v_equip_ids || v_uid;
  end loop;

  -- ---------- members ----------
  for i in 1..40 loop
    v_name := m_first[1 + (i - 1) % 20] || ' ' || m_last[1 + ((i - 1) / 4 + i) % 10];
    v_email := lower(replace(v_name, ' ', '.')) || i || '@purepower.test';
    v_auth := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
                            raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
                            email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', v_auth, 'authenticated', 'authenticated', v_email,
              crypt(v_password, gen_salt('bf')), now(),
              jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'gym_id', v_gym, 'role', 'member'),
              '{}'::jsonb, now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_auth, v_auth::text, jsonb_build_object('sub', v_auth::text, 'email', v_email), 'email', now(), now(), now());

    v_join := v_today - (30 + floor(random() * 200))::int;
    v_motivation := 0.25 + random() * 0.7;
    v_idle := (i % 7 = 0);                 -- these members stopped coming recently (shows up in Alerts)
    if v_idle then v_motivation := 0.3; end if;
    v_shift := (array['morning', 'evening', 'full'])[1 + floor(random() * 3)::int]::shift_type;
    v_pub := next_public_id(v_gym, 'member');

    insert into app_user (auth_id, gym_id, public_id, role, name, age, gender, phone, email, must_change_password)
      values (v_auth, v_gym, v_pub, 'member', v_name, 18 + floor(random() * 35)::int,
              case when i <= 20 then 'male' else 'female' end::gender_type,
              '98' || lpad((10000000 + i)::text, 8, '0'), v_email, false)
      returning user_id into v_uid;
    insert into member (user_id, gym_id, goal, preferred_shift, joined_on)
      values (v_uid, v_gym, goals[1 + floor(random() * 6)::int], v_shift, v_join);
    perform assign_trainer(v_uid);
    select assigned_trainer_id into v_trainer from member where user_id = v_uid;
    v_member_ids := v_member_ids || v_uid;

    -- subscriptions and payments: renewals from the join date up to today
    v_plan := 1 + floor(random() * 3)::int;
    v_cycle_start := v_join;
    v_cycle_end := v_cycle_start + v_plan_days[v_plan];
    while v_cycle_end < v_today loop
      insert into subscription (gym_id, member_id, plan_id, start_date, end_date, status)
        values (v_gym, v_uid, v_plan_ids[v_plan], v_cycle_start, v_cycle_end, 'expired')
        returning sub_id into v_sub;
      insert into payment (gym_id, sub_id, amount, mode, paid_at, reference)
        values (v_gym, v_sub, v_plan_prices[v_plan], case when random() > 0.5 then 'upi' else 'cash' end::payment_mode,
                (v_cycle_start + time '10:00') at time zone 'Asia/Kolkata', v_pub || '-' || v_cycle_start);
      exit when random() < 0.25;   -- some members stop renewing
      v_cycle_start := v_cycle_end;
      v_cycle_end := v_cycle_start + v_plan_days[v_plan];
    end loop;
    insert into subscription (gym_id, member_id, plan_id, start_date, end_date, status)
      values (v_gym, v_uid, v_plan_ids[v_plan], v_cycle_start, v_cycle_end,
              case when v_cycle_end >= v_today then 'active' else 'expired' end::sub_status)
      returning sub_id into v_sub;
    insert into payment (gym_id, sub_id, amount, mode, paid_at, reference)
      values (v_gym, v_sub, v_plan_prices[v_plan], case when random() > 0.5 then 'upi' else 'cash' end::payment_mode,
              (v_cycle_start + time '10:00') at time zone 'Asia/Kolkata', v_pub || '-' || v_cycle_start);

    -- 90 days of attendance. Low-motivation members fade out, which feeds the churn alerts.
    for d in reverse 90..0 loop
      continue when (v_today - d) < v_join;
      continue when v_idle and d < 12 + (i % 3) * 4;
      v_rate := 0.12 + 0.55 * greatest(0.08, v_motivation - 0.0035 * d * (1 - v_motivation));
      if random() < v_rate then
        v_hour := case v_shift when 'morning' then 6 + floor(random() * 3)::int
                               when 'evening' then 17 + floor(random() * 4)::int
                               else 6 + floor(random() * 15)::int end;
        v_in := ((v_today - d) + make_time(v_hour, floor(random() * 60)::int, 0)) at time zone 'Asia/Kolkata';
        continue when v_in > now();
        v_out := v_in + make_interval(mins => 35 + floor(random() * 50)::int);
        if v_out > now() or (d = 0 and random() < 0.4) then v_out := null; end if;
        insert into attendance (gym_id, member_id, attendance_date, check_in, check_out, in_method, out_method, distance_m)
          values (v_gym, v_uid, v_today - d, v_in, v_out, 'qr_gps', case when v_out is null then null else 'qr_gps' end::attend_method,
                  round((random() * 80)::numeric, 1));
      end if;
    end loop;

    -- ratings (trainer, and sometimes equipment) for members who attend enough
    select count(*) into v_days30 from attendance
      where member_id = v_uid and attendance_date >= v_today - 30 and check_in is not null;
    if v_days30 >= 8 then
      if v_trainer is not null and random() < 0.8 then
        insert into rating (gym_id, member_id, trainer_id, score, comment, period_start, created_at)
          values (v_gym, v_uid, v_trainer, 3 + floor(random() * 3)::int,
                  (array['Great sessions', 'Very motivating', 'Helpful and patient', '', 'Good plan for my goal'])[1 + floor(random() * 5)::int],
                  date_trunc('month', v_today)::date, now() - make_interval(days => floor(random() * 20)::int));
      end if;
      if random() < 0.6 then
        insert into rating (gym_id, member_id, equipment_id, score, comment, period_start, created_at)
          values (v_gym, v_uid, v_equip_ids[1 + floor(random() * 12)::int], 2 + floor(random() * 4)::int, '',
                  date_trunc('month', v_today)::date, now() - make_interval(days => floor(random() * 20)::int));
      end if;
    end if;

    -- body metrics
    if random() < 0.4 then
      insert into body_metric (gym_id, member_id, recorded_on, weight_kg, waist_cm) values
        (v_gym, v_uid, v_today - 14, round((60 + random() * 35)::numeric, 1), round((70 + random() * 25)::numeric)),
        (v_gym, v_uid, v_today,      round((59 + random() * 35)::numeric, 1), round((69 + random() * 25)::numeric));
    end if;
  end loop;

  alter table rating enable trigger trg_rating_eligibility;

  -- a few memberships ending this week, so the expiry reminders and renewals have something to show
  update subscription
    set start_date = v_today - 26, end_date = v_today + 2 + (extract(day from now())::int % 5)
    where sub_id in (select sub_id from subscription where gym_id = v_gym and status = 'active' order by sub_id limit 4);

  -- ---------- trainer salaries (last 3 months) ----------
  for i in 1..4 loop
    for k in 1..3 loop
      insert into salary_payment (gym_id, trainer_id, month, amount, paid_on)
        values (v_gym, v_trainer_ids[i], (date_trunc('month', v_today) - make_interval(months => k))::date,
                26000 + i * 3000, (date_trunc('month', v_today) - make_interval(months => k - 1))::date + 1);
    end loop;
  end loop;

  -- ---------- trainer attendance (last 14 days; one request waiting today) ----------
  for i in 1..4 loop
    for d in 0..13 loop
      continue when random() < 0.15 and d > 0;   -- the odd day off
      v_in := ((v_today - d) + make_time(5 + floor(random() * 4)::int, floor(random() * 60)::int, 0)) at time zone 'Asia/Kolkata';
      continue when v_in > now();
      v_out := v_in + make_interval(hours => 8);
      if v_out > now() then v_out := null; end if;
      insert into trainer_attendance (gym_id, trainer_id, attendance_date, check_in, check_out, status, method, decided_by, decided_at)
        values (v_gym, v_trainer_ids[i], v_today - d, v_in, v_out,
                case when d = 0 and i = 1 then 'pending' else 'approved' end::request_status,
                'self', case when d = 0 and i = 1 then null else v_owner end,
                case when d = 0 and i = 1 then null else v_in + interval '20 minutes' end);
    end loop;
  end loop;

  -- ---------- requests waiting for approval today ----------
  insert into attendance_request (gym_id, member_id, trainer_id, method, requested_at, latitude, longitude, accuracy_m, distance_m)
    select v_gym, m.user_id, m.assigned_trainer_id,
           (case when row_number() over () = 1 then 'gps_only' else 'qr_gps' end)::attend_method,
           now() - make_interval(mins => 10 * row_number() over ()::int),
           17.4326 + (random() - 0.5) * 0.001, 78.4071 + (random() - 0.5) * 0.001,
           10 + random() * 30, round((random() * 80)::numeric, 1)
    from member m
    where m.gym_id = v_gym
      and exists (select 1 from subscription s where s.member_id = m.user_id and s.status = 'active' and s.end_date >= v_today)
      and not exists (select 1 from attendance a where a.member_id = m.user_id and a.attendance_date = v_today)
    order by m.user_id
    limit 4;

  -- ---------- trainer change requests ----------
  insert into change_request (gym_id, member_id, from_trainer, reason, status, decided_by, submitted_by)
    select v_gym, m.user_id, m.assigned_trainer_id, r.reason, r.status::request_status,
           case when r.status = 'pending' then null else v_owner end, 'member'
    from (select user_id, assigned_trainer_id, row_number() over (order by user_id) rn
          from member where gym_id = v_gym and assigned_trainer_id is not null) m
    join (values (1, 'My timings changed, I need an evening trainer', 'pending'),
                 (2, 'I would like a trainer who focuses on weight loss', 'approved'),
                 (3, 'Prefer a different trainer', 'rejected')) as r(rn, reason, status) on r.rn = m.rn;

  -- ---------- owner notifications ----------
  insert into notification (gym_id, user_id, type, message) values
    (v_gym, v_owner, 'attendance_requested', 'A member has requested attendance approval.'),
    (v_gym, v_owner, 'trainer_attendance_requested', 'Ravi Teja has requested attendance approval.'),
    (v_gym, v_owner, 'new_member', 'A new member joined and was assigned a trainer.'),
    (v_gym, v_owner, 'expiry_reminder', 'Several memberships end within 7 days.');

  raise notice 'Pure Power demo data created. Sign in as O2601 / Demo@1234 and pick "Pure Power" in the Gym dropdown.';
end
$demo$;

-- CLEANUP (run after deleting the gym in the app, or instead of it):
--   delete from gym where code = 'PWR001';
--   delete from auth.users where email like '%@purepower.test';
