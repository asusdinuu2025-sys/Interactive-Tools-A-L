-- The image-count trigger locks the owning post row to serialize image inserts.
-- SECURITY INVOKER would require broad UPDATE privileges on posts for SELECT FOR UPDATE.
-- Run this narrowly scoped trigger helper as its owner instead; it still verifies auth.uid()
-- and the post author before permitting the image metadata insert.
alter function public.studylab_social_prepare_image() security definer;
