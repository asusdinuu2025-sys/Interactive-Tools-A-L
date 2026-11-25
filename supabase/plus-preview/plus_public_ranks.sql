-- Add publicly visible ranking cosmetics without exposing private pet/workspace settings.
-- Applied AFTER plus_foundation.sql. Existing saved styles are retained.
begin;
alter table public.studylab_plus_appearance drop constraint if exists studylab_plus_appearance_details_check;
update public.studylab_plus_appearance
set details=jsonb_set(jsonb_set(details,'{shape}',to_jsonb(case when details->>'shape'='capsule' then 'teardrop' else details->>'shape' end)),
 '{eyes}',to_jsonb(case when details->>'eyes' in ('star','diamond') then 'default' else details->>'eyes' end))
 || jsonb_build_object(
 'rankDailyColor',coalesce(details->>'rankDailyColor','default'),
 'rankWeeklyColor',coalesce(details->>'rankWeeklyColor','default'),
 'rankPattern',coalesce(details->>'rankPattern','default'));
alter table public.studylab_plus_appearance alter column details set default
 '{"shape":"default","eyes":"default","glow":"default","mouth":"default","eyeColor":"default","timerAccent":"default","workspace":"default","rankDailyColor":"default","rankWeeklyColor":"default","rankPattern":"default"}'::jsonb;
alter table public.studylab_plus_appearance add constraint studylab_plus_appearance_details_check check (
 jsonb_typeof(details)='object'
 and details ?& array['shape','eyes','glow','mouth','eyeColor','timerAccent','workspace','rankDailyColor','rankWeeklyColor','rankPattern']
 and details - array['shape','eyes','glow','mouth','eyeColor','timerAccent','workspace','rankDailyColor','rankWeeklyColor','rankPattern'] = '{}'::jsonb
 and coalesce(details->>'shape','') in ('default','teardrop','square','orb')
 and coalesce(details->>'eyes','') in ('default','round','pixel','arc','visor','softsquare','droplet','focused','sleepy','happy')
 and coalesce(details->>'glow','') in ('default','none','soft','neon','galaxy','spark')
 and coalesce(details->>'mouth','') in ('default','smile','dot','none')
 and coalesce(details->>'eyeColor','') ~ '^(default|#[0-9a-fA-F]{6})$'
 and coalesce(details->>'timerAccent','')='default'
 and coalesce(details->>'workspace','') in ('default','aurora','ocean','galaxy','forest','sunset','prism')
 and coalesce(details->>'rankDailyColor','') ~ '^(default|#[0-9a-fA-F]{6})$'
 and coalesce(details->>'rankWeeklyColor','') ~ '^(default|#[0-9a-fA-F]{6})$'
 and coalesce(details->>'rankPattern','') in ('default','none','science','space','nature','music','books')
);
create or replace function public.studylab_plus_public_styles(p_users uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or coalesce(cardinality(p_users),0)>100 then return '{}'::jsonb; end if;
 select coalesce(jsonb_object_agg(g.user_id::text,jsonb_build_object('active',true,'cover',coalesce(a.cover,'default'),'frame',coalesce(a.frame,'default'),'effect',coalesce(a.effect,'default'),'bubble',coalesce(a.bubble,'default'),'pattern',coalesce(a.pattern,'default'),'cardPattern',coalesce(a.card_pattern,'default'),'cardGlow',coalesce(a.card_glow,'default'),'chatFont',coalesce(a.chat_font,'default'),'rankDailyColor',coalesce(a.details->>'rankDailyColor','default'),'rankWeeklyColor',coalesce(a.details->>'rankWeeklyColor','default'),'rankPattern',coalesce(a.details->>'rankPattern','default'))),'{}'::jsonb) into result
 from public.studylab_plus_grants g join public.studylab_plus_settings s on s.singleton and s.enabled
 join auth.users u on u.id=g.user_id join public.studylab_profiles p on p.id=u.id
 left join public.studylab_plus_appearance a on a.user_id=g.user_id
 where g.user_id=any(p_users) and not coalesce(u.is_anonymous,false) and p.deleted_at is null and (g.expires_at is null or g.expires_at>now());
 return result;
end; $$;
commit;
