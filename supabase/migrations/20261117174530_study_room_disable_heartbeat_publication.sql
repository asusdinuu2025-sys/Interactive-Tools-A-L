-- StudyLab PR #108 Stage 2.
-- Apply ONLY after the new frontend has been deployed and Stage 1
-- state-change signals are verified in a live test session.
-- Stop publishing 20-second heartbeat writes to every subscriber.
-- Reversible: ALTER PUBLICATION supabase_realtime ADD TABLE public.study_room_members;
-- No changes to timer, credited time, pause, away, end, or leaderboard SQL.
BEGIN;
ALTER PUBLICATION supabase_realtime DROP TABLE public.study_room_members;
COMMIT;
