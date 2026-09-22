-- =========================================================
-- STUDY LAB — REMOVE LEGACY REACTIONS
-- Run once in Supabase SQL Editor after the reactions feature
-- has been removed from the StudyLab frontend.
-- =========================================================

drop function if exists public.get_studylab_reaction_summary(text[]);

drop table if exists public.studylab_reactions;
