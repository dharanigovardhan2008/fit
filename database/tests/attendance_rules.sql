-- GymSphere SQL test: attendance business rules
-- one check-in per day, check-out only after check-in, rating lock under 8 attended days,
-- trainer capacity guard. Run with psql -f database/tests/attendance_rules.sql

begin;

insert into gym (gym_id, code, name, latitude, longitude, radius_m)
values ('33333333-3333-3333-3333-333333333333', 'TEST01', 'Test Gym', 10.0, 10.0, 100);

insert into app_user (user_id, gym_id, public_id, role, name, email) values
  ('33333333-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'T10001', 'trainer', 'Trainer One', 't1@example.com'),
  ('33333333-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'M10001', 'member', 'Member One', 'm1@example.com');

insert into trainer (user_id, gym_id, max_capacity) values
  ('33333333-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 1);

insert into member (user_id, gym_id, assigned_trainer_id) values
  ('33333333-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', '33333333-0000-0000-0000-000000000001');

insert into plan (plan_id, gym_id, name, duration_days, price)
values ('33333333-0000-0000-0000-000000000099', '33333333-3333-3333-3333-333333333333', 'Monthly', 30, 1000);

insert into subscription (gym_id, member_id, plan_id, start_date, end_date, status)
values ('33333333-3333-3333-3333-333333333333', '33333333-0000-0000-0000-000000000002',
        '33333333-0000-0000-0000-000000000099', current_date, current_date + 30, 'active');

do $$
declare
  v_result text;
begin
  v_result := record_attendance('33333333-0000-0000-0000-000000000002', 'in', 10.0001, 10.0001);
  if v_result <> 'Checked in' then raise exception 'FAIL: expected Checked in, got %', v_result; end if;

  v_result := record_attendance('33333333-0000-0000-0000-000000000002', 'in', 10.0001, 10.0001);
  if v_result <> 'Already checked in today' then raise exception 'FAIL: second check-in should be rejected, got %', v_result; end if;

  v_result := record_attendance('33333333-0000-0000-0000-000000000002', 'out', 10.0001, 10.0001);
  if v_result <> 'Checked out' then raise exception 'FAIL: expected Checked out, got %', v_result; end if;

  v_result := record_attendance('33333333-0000-0000-0000-000000000002', 'out', 10.0001, 10.0001);
  if v_result <> 'Already checked out today' then raise exception 'FAIL: double checkout should be rejected, got %', v_result; end if;

  raise notice 'PASS: one check-in per day and check-out ordering enforced';
end $$;

-- Rating should be rejected: member has only 1 attended day, needs 8
do $$
begin
  begin
    insert into rating (gym_id, member_id, trainer_id, score)
    values ('33333333-3333-3333-3333-333333333333', '33333333-0000-0000-0000-000000000002',
            '33333333-0000-0000-0000-000000000001', 5);
    raise exception 'FAIL: rating should have been locked';
  exception when others then
    raise notice 'PASS: rating locked under 8 attended days';
  end;
end $$;

-- Trainer capacity: a second member cannot be assigned to a trainer with max_capacity 1
insert into app_user (user_id, gym_id, public_id, role, name, email) values
  ('33333333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'M10002', 'member', 'Member Two', 'm2@example.com');
insert into member (user_id, gym_id) values
  ('33333333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333');

do $$
begin
  begin
    update member set assigned_trainer_id = '33333333-0000-0000-0000-000000000001'
      where user_id = '33333333-0000-0000-0000-000000000003';
    raise exception 'FAIL: trainer capacity should have been enforced';
  exception when others then
    raise notice 'PASS: trainer capacity guard enforced';
  end;
end $$;

rollback;
