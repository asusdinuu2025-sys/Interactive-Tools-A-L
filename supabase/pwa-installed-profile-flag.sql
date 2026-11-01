-- Minimal PWA installation status stored on each student's existing profile.
-- This change has already been applied to the connected Supabase project.
-- Existing profiles default to No; the app changes the value to Yes after
-- a successful install event or when the installed app is opened.

alter table public.studylab_profiles
  add column if not exists pwa_installed text not null default 'No'
  check (pwa_installed in ('Yes', 'No'));
