-- Security hardening for chat authorization. TRUNCATE bypasses RLS and
-- must never be allowed from browser-authenticated roles.
revoke truncate, trigger, references on public.studylab_chat_messages
  from authenticated, anon, public;
revoke truncate, trigger, references on public.studylab_chat_reactions
  from authenticated, anon, public;

-- Reaction switches can only change the emoji, not user_id/message_id.
revoke update on public.studylab_chat_reactions from authenticated;
grant update (reaction) on public.studylab_chat_reactions to authenticated;

-- Preserve the existing message INSERT/SELECT grants, and UPDATE(message)
-- and DELETE grants with strict owner-only RLS.
