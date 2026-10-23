-- GymSphere migration 0007: row level security on every table

alter table gym enable row level security;
alter table id_counter enable row level security;
alter table app_user enable row level security;
alter table trainer enable row level security;
alter table member enable row level security;
alter table plan enable row level security;
alter table subscription enable row level security;
alter table payment enable row level security;
alter table attendance enable row level security;
alter table equipment enable row level security;
alter table rating enable row level security;
alter table change_request enable row level security;
alter table salary_payment enable row level security;
alter table body_metric enable row level security;
alter table notification enable row level security;
alter table churn_alert enable row level security;
alter table event enable row level security;
alter table attendance_audit enable row level security;

-- gym: any authenticated member of the gym can read; only the owner can update
create policy gym_select on gym for select using (gym_id = jwt_gym_id());
create policy gym_update on gym for update using (gym_id = jwt_gym_id() and jwt_role() = 'owner');

-- id_counter: service role only (used by Edge Functions), never readable by clients
create policy id_counter_none on id_counter for all using (false);

-- app_user: owner sees everyone in the gym; trainer sees self and their members; member sees self
create policy app_user_select on app_user for select using (
  gym_id = jwt_gym_id() and (
    jwt_role() = 'owner'
    or user_id = jwt_user_id()
    or (jwt_role() = 'trainer' and user_id in (
      select m.user_id from member m where m.assigned_trainer_id = jwt_user_id()
    ))
  )
);
create policy app_user_update_self on app_user for update using (
  gym_id = jwt_gym_id() and (jwt_role() = 'owner' or user_id = jwt_user_id())
);

-- trainer table
create policy trainer_select on trainer for select using (
  gym_id = jwt_gym_id() and (jwt_role() = 'owner' or user_id = jwt_user_id())
);
create policy trainer_write on trainer for all using (
  gym_id = jwt_gym_id() and jwt_role() = 'owner'
);

-- member table
create policy member_select on member for select using (
  gym_id = jwt_gym_id() and (
    jwt_role() = 'owner'
    or user_id = jwt_user_id()
    or (jwt_role() = 'trainer' and assigned_trainer_id = jwt_user_id())
  )
);
create policy member_write_owner on member for all using (
  gym_id = jwt_gym_id() and jwt_role() = 'owner'
);
create policy member_update_self on member for update using (
  gym_id = jwt_gym_id() and user_id = jwt_user_id()
);

-- plan: readable by everyone in the gym, writable by the owner
create policy plan_select on plan for select using (gym_id = jwt_gym_id());
create policy plan_write on plan for all using (gym_id = jwt_gym_id() and jwt_role() = 'owner');

-- subscription: owner all; trainer reads their members'; member reads own
create policy subscription_select on subscription for select using (
  gym_id = jwt_gym_id() and (
    jwt_role() = 'owner'
    or member_id = jwt_user_id()
    or (jwt_role() = 'trainer' and member_id in (
      select user_id from member where assigned_trainer_id = jwt_user_id()
    ))
  )
);
create policy subscription_write on subscription for all using (
  gym_id = jwt_gym_id() and jwt_role() = 'owner'
);

-- payment: owner only
create policy payment_owner on payment for all using (
  gym_id = jwt_gym_id() and jwt_role() = 'owner'
);
create policy payment_select_self on payment for select using (
  gym_id = jwt_gym_id() and sub_id in (select sub_id from subscription where member_id = jwt_user_id())
);

-- attendance: owner all; trainer reads/corrects their members'; member reads/writes own
create policy attendance_select on attendance for select using (
  gym_id = jwt_gym_id() and (
    jwt_role() = 'owner'
    or member_id = jwt_user_id()
    or (jwt_role() = 'trainer' and member_id in (
      select user_id from member where assigned_trainer_id = jwt_user_id()
    ))
  )
);
create policy attendance_write_owner on attendance for all using (
  gym_id = jwt_gym_id() and jwt_role() = 'owner'
);
create policy attendance_write_trainer on attendance for update using (
  gym_id = jwt_gym_id() and jwt_role() = 'trainer' and member_id in (
    select user_id from member where assigned_trainer_id = jwt_user_id()
  )
);
create policy attendance_write_self on attendance for insert with check (
  gym_id = jwt_gym_id() and member_id = jwt_user_id()
);
create policy attendance_update_self on attendance for update using (
  gym_id = jwt_gym_id() and member_id = jwt_user_id()
);

-- equipment: readable by everyone in the gym, writable by owner
create policy equipment_select on equipment for select using (gym_id = jwt_gym_id());
create policy equipment_write on equipment for all using (gym_id = jwt_gym_id() and jwt_role() = 'owner');

-- rating: owner reads all; trainer reads ratings about them; member manages their own
create policy rating_select on rating for select using (
  gym_id = jwt_gym_id() and (
    jwt_role() = 'owner'
    or member_id = jwt_user_id()
    or (jwt_role() = 'trainer' and trainer_id = jwt_user_id())
  )
);
create policy rating_write_self on rating for insert with check (
  gym_id = jwt_gym_id() and member_id = jwt_user_id()
);

-- change_request: owner all; trainer reads requests involving them; member manages their own
create policy change_request_select on change_request for select using (
  gym_id = jwt_gym_id() and (
    jwt_role() = 'owner'
    or member_id = jwt_user_id()
    or (jwt_role() = 'trainer' and jwt_user_id() in (from_trainer, to_trainer))
  )
);
create policy change_request_write_self on change_request for insert with check (
  gym_id = jwt_gym_id() and member_id = jwt_user_id()
);
create policy change_request_decide_owner on change_request for update using (
  gym_id = jwt_gym_id() and jwt_role() = 'owner'
);

-- salary_payment: owner all; trainer reads own
create policy salary_select on salary_payment for select using (
  gym_id = jwt_gym_id() and (jwt_role() = 'owner' or trainer_id = jwt_user_id())
);
create policy salary_write on salary_payment for all using (
  gym_id = jwt_gym_id() and jwt_role() = 'owner'
);

-- body_metric: member manages their own; owner and their trainer read
create policy body_metric_select on body_metric for select using (
  gym_id = jwt_gym_id() and (
    jwt_role() = 'owner'
    or member_id = jwt_user_id()
    or (jwt_role() = 'trainer' and member_id in (
      select user_id from member where assigned_trainer_id = jwt_user_id()
    ))
  )
);
create policy body_metric_write_self on body_metric for all using (
  gym_id = jwt_gym_id() and member_id = jwt_user_id()
);

-- notification: user reads and updates (mark read) their own
create policy notification_select on notification for select using (
  gym_id = jwt_gym_id() and user_id = jwt_user_id()
);
create policy notification_update_self on notification for update using (
  gym_id = jwt_gym_id() and user_id = jwt_user_id()
);

-- churn_alert: owner reads all; trainer reads alerts for their own members
create policy churn_select on churn_alert for select using (
  gym_id = jwt_gym_id() and (
    jwt_role() = 'owner'
    or (jwt_role() = 'trainer' and member_id in (
      select user_id from member where assigned_trainer_id = jwt_user_id()
    ))
  )
);

-- event: append-only log, owner reads all, others read their own actions
create policy event_select on event for select using (
  gym_id = jwt_gym_id() and (jwt_role() = 'owner' or actor_id = jwt_user_id())
);
create policy event_insert on event for insert with check (gym_id = jwt_gym_id());

-- attendance_audit: owner and the trainer who made the change
create policy attendance_audit_select on attendance_audit for select using (
  gym_id = jwt_gym_id() and (jwt_role() = 'owner' or changed_by = jwt_user_id())
);
