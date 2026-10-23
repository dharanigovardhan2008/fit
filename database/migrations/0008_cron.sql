-- GymSphere migration 0008: scheduled jobs (pg_cron, free tier compatible)

select cron.schedule('gymsphere-auto-close', '*/15 * * * *', $$select auto_close_sessions();$$);
select cron.schedule('gymsphere-sub-status', '5 0 * * *', $$select update_subscription_status();$$);
select cron.schedule('gymsphere-expiry-reminders', '10 0 * * *', $$select send_expiry_reminders();$$);
