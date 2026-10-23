-- Device push notifications (web push).
create extension if not exists pg_net with schema extensions;

create table if not exists push_subscription (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references app_user(user_id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscription_user on push_subscription(user_id);

alter table push_subscription enable row level security;

drop policy if exists push_sub_own on push_subscription;
create policy push_sub_own on push_subscription for all
  using (user_id in (select user_id from app_user where auth_id = auth.uid()))
  with check (user_id in (select user_id from app_user where auth_id = auth.uid()));

-- Where to send and the shared secret. Filled in once, see README. Nobody can read it from the app.
create table if not exists push_config (key text primary key, value text not null);
alter table push_config enable row level security;

create or replace function send_push_for_notification() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  select value into v_url from push_config where key = 'url';
  select value into v_secret from push_config where key = 'secret';
  if v_url is null or v_secret is null then return new; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object('user_id', new.user_id, 'message', new.message, 'type', new.type)
  );
  return new;
exception when others then
  return new; -- a push problem must never block the notification itself
end $$;

drop trigger if exists notification_push on notification;
create trigger notification_push after insert on notification
  for each row execute function send_push_for_notification();
