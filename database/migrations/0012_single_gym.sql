-- GymSphere migration 0012: single-gym mode and safe removal of people

-- Only one gym can ever exist in this database.
create unique index if not exists one_gym_only on gym ((true));

-- Removes a trainer or member and everything that belongs to them.
-- Called only by the delete-user Edge Function (service role).
create or replace function remove_person(p_user uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Members of a removed trainer become unassigned (the Edge Function re-assigns them afterwards).
  update member set assigned_trainer_id = null where assigned_trainer_id = p_user;

  -- Ratings about a removed trainer
  delete from rating where trainer_id = p_user and equipment_id is null;
  update rating set trainer_id = null where trainer_id = p_user;

  -- Anything that only points at this person as a reference
  update change_request set from_trainer = null where from_trainer = p_user;
  update change_request set to_trainer = null where to_trainer = p_user;
  update change_request set decided_by = null where decided_by = p_user;
  delete from change_request where member_id = p_user;
  update attendance_request set trainer_id = null where trainer_id = p_user;
  update attendance_request set decided_by = null where decided_by = p_user;
  update attendance set edited_by = null where edited_by = p_user;
  update attendance_audit set changed_by = null where changed_by = p_user;
  update event set actor_id = null where actor_id = p_user;

  -- Cascades to trainer / member rows, subscriptions, payments, attendance, notifications ...
  delete from app_user where user_id = p_user;
end;
$$;

revoke execute on function remove_person(uuid) from public, anon, authenticated;
