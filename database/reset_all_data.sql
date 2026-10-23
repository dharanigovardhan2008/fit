-- GymSphere: ERASE EVERYTHING and start fresh.
-- Run this ONCE in the Supabase SQL Editor. It deletes the gym, every person, all attendance,
-- payments and all sign-in accounts. It cannot be undone. Your tables and functions stay.

truncate table gym cascade;
delete from auth.users;
