-- GymSphere migration 0011: shorter public ids (O2601, T2601, M2601 ...)
-- New gyms start each role at 2601. Counters that already exist keep counting from where they are.

create or replace function next_public_id(p_gym uuid, p_role user_role)
returns text
language plpgsql as $$
declare
  v_prefix char(1);
  v_next int;
begin
  v_prefix := case p_role when 'owner' then 'O' when 'trainer' then 'T' else 'M' end;

  insert into id_counter (gym_id, role, last_number)
    values (p_gym, p_role, 2600)
  on conflict (gym_id, role) do nothing;

  update id_counter
    set last_number = last_number + 1
    where gym_id = p_gym and role = p_role
    returning last_number into v_next;

  return v_prefix || v_next::text;
end;
$$;
