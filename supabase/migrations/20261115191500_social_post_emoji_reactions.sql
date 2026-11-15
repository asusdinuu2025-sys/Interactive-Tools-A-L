-- Four optional emoji reactions alongside existing Social Like and Comment actions.
-- One reaction per student per approved post. Existing likes remain unchanged.
create table if not exists public.studylab_social_post_reactions (
  post_id uuid not null references public.studylab_social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('👍','😂','🔥','❤️')),
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);
create index if not exists studylab_social_post_reactions_user_idx
  on public.studylab_social_post_reactions(user_id);

alter table public.studylab_social_post_reactions enable row level security;
revoke all on public.studylab_social_post_reactions from anon;
revoke truncate, trigger, references on public.studylab_social_post_reactions from authenticated;
grant select, insert, delete on public.studylab_social_post_reactions to authenticated;
grant update (reaction) on public.studylab_social_post_reactions to authenticated;

drop policy if exists "Approved social post reactions visible" on public.studylab_social_post_reactions;
create policy "Approved social post reactions visible"
on public.studylab_social_post_reactions for select to authenticated
using (exists (
  select 1 from public.studylab_social_posts p
  where p.id=post_id and p.status='approved'
));

drop policy if exists "Own reaction on approved post" on public.studylab_social_post_reactions;
create policy "Own reaction on approved post"
on public.studylab_social_post_reactions for insert to authenticated
with check (
  user_id=(select auth.uid())
  and exists (select 1 from public.studylab_social_posts p
    where p.id=post_id and p.status='approved')
);

drop policy if exists "Change own reaction" on public.studylab_social_post_reactions;
create policy "Change own reaction"
on public.studylab_social_post_reactions for update to authenticated
using (user_id=(select auth.uid()))
with check (
  user_id=(select auth.uid())
  and exists (select 1 from public.studylab_social_posts p
    where p.id=post_id and p.status='approved')
);

drop policy if exists "Remove own reaction" on public.studylab_social_post_reactions;
create policy "Remove own reaction"
on public.studylab_social_post_reactions for delete to authenticated
using (user_id=(select auth.uid()));

-- Foreign-key cascades handle both account deletion and post deletion.
-- Intentionally no chat table, Like table, or progress changes.
