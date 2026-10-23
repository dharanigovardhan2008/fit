-- GymSphere migration 0004: core SQL functions

-- Returns gym_id from the current JWT app_metadata
create or replace function jwt_gym_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'gym_id', '')::uuid
$$;

-- Returns role from the current JWT app_metadata
create or replace function jwt_role() returns text
language sql stable as $$
  select auth.jwt() -> 'app_metadata' ->> 'role'
$$;

-- Returns the app_user.user_id for the current JWT
create or replace function jwt_user_id() returns uuid
language sql stable as $$
  select user_id from app_user where auth_id = auth.uid()
$$;

-- Allocates the next public id (O/T/M + 5 digit sequence) for a gym and role
create or replace function next_public_id(p_gym uuid, p_role user_role)
returns text
language plpgsql as $$
declare
  v_prefix char(1);
  v_next int;
begin
  v_prefix := case p_role when 'owner' then 'O' when 'trainer' then 'T' else 'M' end;

  insert into id_counter (gym_id, role, last_number)
    values (p_gym, p_role, 10000)
  on conflict (gym_id, role) do nothing;

  update id_counter
    set last_number = last_number + 1
    where gym_id = p_gym and role = p_role
    returning last_number into v_next;

  return v_prefix || v_next::text;
end;
$$;

-- Haversine distance in metres
create or replace function distance_m(lat1 double precision, lon1 double precision,
                                       lat2 double precision, lon2 double precision)
returns double precision
language sql immutable as $$
  select 6371000 * 2 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ^ 2
  ))
$$;

-- Chooses the best trainer for a member, or waitlists them
create or replace function assign_trainer(p_member uuid)
returns void
language plpgsql as $$
declare
  v_gym uuid;
  v_shift shift_type;
  v_goal text;
  v_best uuid;
  v_best_score numeric := -1;
  rec record;
  v_current_count int;
  v_specialty_match numeric;
  v_avg_rating numeric;
  v_score numeric;
  v_owner uuid;
begin
  select gym_id, preferred_shift, goal into v_gym, v_shift, v_goal from member where user_id = p_member;

  for rec in
    select t.user_id, t.max_capacity, t.specialty
    from trainer t
    join app_user u on u.user_id = t.user_id
    where t.gym_id = v_gym and u.is_active
      and (t.shift = v_shift or t.shift = 'full')
  loop
    select count(*) into v_current_count from member where assigned_trainer_id = rec.user_id;
    if v_current_count >= rec.max_capacity then
      continue;
    end if;

    v_specialty_match := case when rec.specialty is not null and v_goal is not null
      and position(lower(rec.specialty) in lower(v_goal)) > 0 then 1 else 0 end;

    select coalesce(avg(score), 3) into v_avg_rating from rating where trainer_id = rec.user_id;

    v_score := 0.5 * (1 - (v_current_count::numeric / greatest(rec.max_capacity, 1)))
      + 0.3 * v_specialty_match
      + 0.2 * (v_avg_rating / 5);

    if v_score > v_best_score then
      v_best_score := v_score;
      v_best := rec.user_id;
    end if;
  end loop;

  if v_best is not null then
    update member set assigned_trainer_id = v_best, waitlisted = false where user_id = p_member;
  else
    update member set waitlisted = true where user_id = p_member;
    select user_id into v_owner from app_user where gym_id = v_gym and role = 'owner' limit 1;
    if v_owner is not null then
      insert into notification (gym_id, user_id, type, message)
        values (v_gym, v_owner, 'waitlist', 'A new member could not be assigned a trainer and is waitlisted.');
    end if;
  end if;
end;
$$;

-- Records a QR + GPS attendance event, returns a clear status string
create or replace function record_attendance(p_member uuid, p_type text, p_lat double precision,
                                              p_lng double precision, p_method attend_method default 'qr_gps')
returns text
language plpgsql as $$
declare
  v_gym uuid;
  v_glat double precision;
  v_glng double precision;
  v_radius int;
  v_dist double precision;
  v_has_sub boolean;
  v_today date := current_date;
  v_row attendance%rowtype;
begin
  select gym_id into v_gym from member where user_id = p_member;
  select latitude, longitude, radius_m into v_glat, v_glng, v_radius from gym where gym_id = v_gym;

  select exists(
    select 1 from subscription
    where member_id = p_member and status = 'active' and end_date >= v_today
  ) into v_has_sub;

  if not v_has_sub then
    return 'No active subscription';
  end if;

  if v_glat is not null and p_lat is not null then
    v_dist := distance_m(v_glat, v_glng, p_lat, p_lng);
    if v_dist > v_radius then
      return 'You are too far from the gym';
    end if;
  end if;

  select * into v_row from attendance where member_id = p_member and attendance_date = v_today;

  if p_type = 'in' then
    if found then
      return 'Already checked in today';
    end if;
    insert into attendance (gym_id, member_id, attendance_date, check_in, in_method, distance_m)
      values (v_gym, p_member, v_today, now(), p_method, v_dist);
    insert into event (gym_id, type, actor_id, payload)
      values (v_gym, 'check_in', p_member, jsonb_build_object('distance_m', v_dist));
    return 'Checked in';
  else
    if not found or v_row.check_in is null then
      return 'No check-in yet today';
    end if;
    if v_row.check_out is not null then
      return 'Already checked out today';
    end if;
    update attendance set check_out = now(), out_method = p_method where att_id = v_row.att_id;
    insert into event (gym_id, type, actor_id, payload)
      values (v_gym, 'check_out', p_member, jsonb_build_object('distance_m', v_dist));
    return 'Checked out';
  end if;
end;
$$;

-- Closes sessions still open after the gym closing time
create or replace function auto_close_sessions()
returns void
language plpgsql as $$
begin
  update attendance a
  set check_out = (a.attendance_date + g.closing_time)::timestamptz,
      out_method = 'auto_close'
  from gym g
  where g.gym_id = a.gym_id
    and a.check_in is not null
    and a.check_out is null
    and a.attendance_date < current_date
    and (a.attendance_date + g.closing_time)::timestamptz < now();
end;
$$;

-- Marks subscriptions past their end date as expired
create or replace function update_subscription_status()
returns void
language sql as $$
  update subscription set status = 'expired'
  where status = 'active' and end_date < current_date;
$$;

-- Sends expiry reminder notifications at 7, 3 and 0 days before end_date
create or replace function send_expiry_reminders()
returns void
language plpgsql as $$
begin
  insert into notification (gym_id, user_id, type, message)
  select s.gym_id, m.user_id, 'expiry_reminder',
    case (s.end_date - current_date)
      when 7 then 'Your subscription ends in 7 days.'
      when 3 then 'Your subscription ends in 3 days.'
      when 0 then 'Your subscription ends today.'
    end
  from subscription s
  join member m on m.user_id = s.member_id
  where s.status = 'active' and (s.end_date - current_date) in (7, 3, 0);
end;
$$;
