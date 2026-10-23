-- GymSphere migration 0001: extensions and enums

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

do $$ begin
  create type user_role as enum ('owner', 'trainer', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sub_status as enum ('active', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attend_method as enum ('qr_gps', 'manual', 'geofence', 'auto_close');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shift_type as enum ('morning', 'evening', 'full');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gender_type as enum ('male', 'female', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_mode as enum ('cash', 'upi', 'card');
exception when duplicate_object then null; end $$;
