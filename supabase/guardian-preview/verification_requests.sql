begin;
create table public.studylab_verification_requests(
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null
);
alter table public.studylab_verification_requests enable row level security;
revoke all on public.studylab_verification_requests from public,anon,authenticated;
grant select on public.studylab_verification_requests to authenticated;
create policy verification_requests_read on public.studylab_verification_requests for select to authenticated using (user_id=(select auth.uid()) or (select public.studylab_social_is_admin()));
create function public.studylab_request_verification() returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); prior public.studylab_verification_requests%rowtype;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and coalesce(is_anonymous,false)=false) or not exists(select 1 from public.studylab_profiles where id=uid and deleted_at is null and profile_completed_at is not null) then raise exception 'Complete your registered profile first' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,124));
 if exists(select 1 from public.studylab_verifications where user_id=uid) then return 'verified'; end if;
 select * into prior from public.studylab_verification_requests where user_id=uid for update;
 if found and prior.status='pending' then return 'pending'; end if;
 if found and prior.reviewed_at>now()-interval '7 days' then return prior.status; end if;
 insert into public.studylab_verification_requests(user_id) values(uid) on conflict(user_id) do update set status='pending',requested_at=now(),reviewed_at=null,reviewed_by=null;
 return 'pending';
end; $$;
create function public.studylab_review_verification(p_user uuid,p_approve boolean) returns text language plpgsql security definer set search_path='' as $$
declare outcome text;
begin
 if not public.studylab_social_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_approve is null then raise exception 'Choose a decision'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,124));
 perform 1 from public.studylab_verification_requests where user_id=p_user and status='pending' for update;
 if not found then raise exception 'Request is no longer pending'; end if;
 if p_approve then perform public.studylab_admin_user_set(p_user,'verified',true); end if;
 outcome:=case when p_approve then 'approved' else 'rejected' end;
 update public.studylab_verification_requests set status=outcome,reviewed_at=now(),reviewed_by=auth.uid() where user_id=p_user;
 return outcome;
end; $$;
create function public.studylab_verification_queue() returns table(user_id uuid,display_name text,username text,requested_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.studylab_social_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 return query select r.user_id,p.display_name,p.username,r.requested_at from public.studylab_verification_requests r join public.studylab_profiles p on p.id=r.user_id where r.status='pending' and p.deleted_at is null order by r.requested_at limit 100;
end; $$;
revoke all on function public.studylab_request_verification(),public.studylab_review_verification(uuid,boolean),public.studylab_verification_queue() from public,anon,authenticated;
grant execute on function public.studylab_request_verification(),public.studylab_review_verification(uuid,boolean),public.studylab_verification_queue() to authenticated;
commit;