-- StudyLab student profile completion fields.
-- Safe to run once in Supabase SQL Editor. Existing profile rows are preserved.
alter table public.studylab_profiles
  add column if not exists school text,
  add column if not exists phone text,
  add column if not exists exam_year text,
  add column if not exists study_stream text,
  add column if not exists profile_completed_at timestamptz;

-- Existing row-level security policies still restrict profile rows to their owner.
