-- When an away session expires at midnight, subtract its unconfirmed
-- contribution from the old day's counters, then reset today's bucket to zero.
CREATE OR REPLACE FUNCTION study_room_private.expire_member_session(
  p_user_id uuid,
  p_expired_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_row public.study_room_members%rowtype;
  local_day date := timezone('Asia/Colombo', p_expired_at)::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', p_expired_at)::date);
  pending integer;
BEGIN
  SELECT * INTO current_row
  FROM public.study_room_members
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  pending := greatest(0, coalesce(current_row.session_away_pending_seconds, 0));

  UPDATE public.study_room_members
  SET
    today_seconds = CASE
      WHEN current_row.today_date = local_day THEN
        CASE
          WHEN current_row.today_date = current_row.session_away_pending_date
            THEN greatest(0, coalesce(current_row.today_seconds, 0) - pending)
          ELSE coalesce(current_row.today_seconds, 0)
        END
      ELSE 0
    END,
    today_date = local_day,
    week_seconds = CASE
      WHEN current_row.week_start = current_row.session_away_pending_week_start
        THEN greatest(0, coalesce(current_row.week_seconds, 0) - pending)
      ELSE coalesce(current_row.week_seconds, 0)
    END,
    session_week_seconds = CASE
      WHEN current_row.session_week_start = current_row.session_away_pending_week_start
        THEN greatest(0, coalesce(current_row.session_week_seconds, 0) - pending)
      ELSE coalesce(current_row.session_week_seconds, 0)
    END,
    is_studying = false,
    session_active = false,
    session_presence_state = 'paused',
    session_target_seconds = NULL,
    session_target_reached_at = NULL,
    session_away_since_at = NULL,
    session_away_pending_seconds = 0,
    session_away_pending_date = local_day,
    session_away_pending_week_start = monday,
    session_started_at = NULL,
    last_heartbeat_at = NULL,
    session_elapsed_seconds = 0,
    session_date = local_day,
    session_today_seconds = 0,
    session_today_date = local_day,
    session_week_seconds = 0,
    session_week_start = monday,
    session_expired_at = p_expired_at,
    updated_at = p_expired_at
  WHERE user_id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION study_room_private.expire_member_session(uuid, timestamptz) FROM public, anon, authenticated;
