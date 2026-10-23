-- GymSphere migration 0005: triggers enforcing business rules

-- Trainer capacity guard
create or replace function check_trainer_capacity() returns trigger
language plpgsql as $$
declare
  v_count int;
  v_capacity int;
begin
  if new.assigned_trainer_id is null then
    return new;
  end if;
  select max_capacity into v_capacity from trainer where user_id = new.assigned_trainer_id;
  select count(*) into v_count from member
    where assigned_trainer_id = new.assigned_trainer_id and user_id <> coalesce(old.user_id, '00000000-0000-0000-0000-000000000000');
  if v_count >= v_capacity then
    raise exception 'Trainer has reached maximum capacity';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trainer_capacity on member;
create trigger trg_trainer_capacity
  before insert or update of assigned_trainer_id on member
  for each row execute function check_trainer_capacity();

-- Rating requires at least 8 attended days in the last 30 for that member
create or replace function check_rating_eligibility() returns trigger
language plpgsql as $$
declare
  v_days int;
begin
  select count(*) into v_days from attendance
    where member_id = new.member_id
      and attendance_date >= current_date - interval '30 days'
      and check_in is not null;
  if v_days < 8 then
    raise exception 'Rating locked: attend at least 8 days in the last 30 days first';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rating_eligibility on rating;
create trigger trg_rating_eligibility
  before insert on rating
  for each row execute function check_rating_eligibility();

-- Keep attendance_audit when a correction is made to an existing row
create or replace function audit_attendance_change() returns trigger
language plpgsql as $$
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

drop trigger if exists trg_attendance_audit on attendance;
create trigger trg_attendance_audit
  after update on attendance
  for each row execute function audit_attendance_change();
