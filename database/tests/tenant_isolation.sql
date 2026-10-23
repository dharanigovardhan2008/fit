-- GymSphere SQL test: a user of gym A must never read or write rows of gym B.
-- Run with: psql -f database/tests/tenant_isolation.sql (against a database with the
-- migrations applied). Uses SET LOCAL to simulate two different JWTs via request.jwt.claims.

begin;

insert into gym (gym_id, code, name) values
  ('11111111-1111-1111-1111-111111111111', 'GYMA01', 'Gym A'),
  ('22222222-2222-2222-2222-222222222222', 'GYMB01', 'Gym B');

insert into app_user (user_id, gym_id, public_id, role, name, email)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'O10001', 'owner', 'Owner A', 'owner.a@example.com'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'O10001', 'owner', 'Owner B', 'owner.b@example.com');

-- Simulate owner A's JWT
set local request.jwt.claims = '{"app_metadata": {"gym_id": "11111111-1111-1111-1111-111111111111", "role": "owner"}}';

do $$
declare
  v_count int;
begin
  select count(*) into v_count from gym; -- RLS limits to gym A only
  if v_count <> 1 then
    raise exception 'FAIL: owner A can see % gyms, expected 1', v_count;
  end if;

  select count(*) into v_count from app_user where public_id = 'O10001';
  if v_count <> 1 then
    raise exception 'FAIL: owner A can see % app_user rows named O10001, expected 1 (own gym only)', v_count;
  end if;

  raise notice 'PASS: gym isolation holds for gym/app_user select';
end $$;

rollback;
