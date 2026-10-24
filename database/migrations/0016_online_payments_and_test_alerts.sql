-- Opsyl Fit migration 0016: online payments (Cashfree) and test alerts. Run after 0015.

-- An online payment in progress. The member form (or the renewal choice) waits here while the person
-- pays on the Cashfree page. No policies, so only the server functions can read or write it.
create table if not exists payment_order (
  order_id   text primary key,
  gym_id     uuid not null references gym(gym_id) on delete cascade,
  created_by uuid not null references app_user(user_id) on delete cascade,
  kind       text not null check (kind in ('member', 'renewal')),
  amount     numeric(10, 2) not null,
  payload    jsonb not null default '{}'::jsonb,
  status     text not null default 'created' check (status in ('created', 'processing', 'done', 'failed')),
  created_at timestamptz not null default now()
);
alter table payment_order enable row level security;

-- Owner sends a test alert to one person and learns whether that person has a device registered.
create or replace function send_test_notification(p_user uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_devices int;
begin
  if jwt_role() <> 'owner' or not exists (select 1 from app_user where user_id = p_user and gym_id = jwt_gym_id()) then
    raise exception 'not allowed';
  end if;
  insert into notification (gym_id, user_id, type, message)
    values (jwt_gym_id(), p_user, 'test', 'Test alert from your gym. If you can read this on your phone, notifications are working!');
  select count(*) into v_devices from push_subscription where user_id = p_user;
  return v_devices;
end $$;
grant execute on function send_test_notification(uuid) to authenticated;
