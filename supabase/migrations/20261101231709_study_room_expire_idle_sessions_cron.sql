-- Physically clear abandoned running Study Room sessions every minute.
-- The live view masks sessions at the exact 24-hour boundary; this job persists
-- the stop/reset even when no students are actively using the room.
SELECT cron.schedule(
  'study-room-expire-idle-sessions',
  '* * * * *',
  $job$
    UPDATE public.study_room_members
    SET is_studying = false,
        session_active = false,
        session_started_at = NULL,
        last_heartbeat_at = NULL,
        session_elapsed_seconds = 0,
        session_date = timezone('Asia/Colombo', now())::date,
        today_seconds = 0,
        today_date = timezone('Asia/Colombo', now())::date,
        week_seconds = 0,
        week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date),
        updated_at = now()
    WHERE is_studying = true
      AND (
        last_heartbeat_at IS NULL
        OR last_heartbeat_at <= now() - interval '24 hours'
      );
  $job$
);
