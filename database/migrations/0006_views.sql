-- GymSphere migration 0006: reporting views

create or replace view v_member_features as
select
  m.user_id as member_id,
  m.gym_id,
  count(a.*) filter (where a.attendance_date >= current_date - interval '7 days') as visits_7d,
  count(a.*) filter (where a.attendance_date >= current_date - interval '30 days') as visits_30d,
  count(a.*) filter (where a.attendance_date >= current_date - interval '60 days'
                        and a.attendance_date < current_date - interval '30 days') as visits_prev_30d,
  (current_date - max(a.attendance_date)) as days_since_last_visit,
  (select min(s.end_date) - current_date from subscription s
     where s.member_id = m.user_id and s.status = 'active') as days_to_expiry,
  (select avg(r.score) from rating r where r.member_id = m.user_id) as avg_rating_given,
  (current_date - m.joined_on) as tenure_days
from member m
left join attendance a on a.member_id = m.user_id
group by m.user_id, m.gym_id, m.joined_on;

create or replace view v_daily_attendance as
select gym_id, attendance_date as date, extract(hour from check_in)::int as hour, count(*) as visits
from attendance
where check_in is not null
group by gym_id, attendance_date, extract(hour from check_in);

create or replace view v_revenue_monthly as
select gym_id, date_trunc('month', paid_at)::date as month, sum(amount) as revenue
from payment
group by gym_id, date_trunc('month', paid_at);
