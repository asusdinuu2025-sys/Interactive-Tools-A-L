-- Add publicly visible ranking cosmetics after the Plus foundation.
-- Older clients can still save their existing appearance fields.
begin;

create schema if not exists studylab_private;
revoke all on schema studylab_private from public, anon, authenticated;

create or replace function studylab_private.plus_ranking_details(p_details jsonb, p_previous jsonb)
returns jsonb
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_details) = 'object' then
    jsonb_build_object(
      'rankDailyColor', coalesce(p_previous->>'rankDailyColor', 'default'),
      'rankWeeklyColor', coalesce(p_previous->>'rankWeeklyColor', 'default'),
      'rankPattern', coalesce(p_previous->>'rankPattern', 'default')
    ) || p_details
      || case when p_details->>'shape' = 'capsule' then '{"shape":"teardrop"}'::jsonb else '{}'::jsonb end
      || case when p_details->>'eyes' in ('star', 'diamond') then '{"eyes":"default"}'::jsonb else '{}'::jsonb end
  else p_details end;
$$;
revoke all on function studylab_private.plus_ranking_details(jsonb, jsonb) from public, anon, authenticated;

alter table public.studylab_plus_appearance drop constraint if exists studylab_plus_appearance_details_check;
update public.studylab_plus_appearance
set details = studylab_private.plus_ranking_details(details, '{}'::jsonb);
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

create or replace function public.studylab_plus_save_appearance(
  p_cover text, p_frame text, p_effect text, p_bubble text, p_pet text, p_timer text,
  p_details jsonb, p_pattern text, p_card_pattern text, p_card_glow text, p_chat_font text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not coalesce((public.studylab_plus_status()->>'active')::boolean, false) then
    raise exception 'Active Plus required' using errcode = '42501';
  end if;

  insert into public.studylab_plus_appearance as appearance (
    user_id, cover, frame, effect, bubble, pet, timer, details, pattern, card_pattern, card_glow, chat_font
  ) values (
    uid, p_cover, p_frame, p_effect, p_bubble, p_pet, p_timer,
    studylab_private.plus_ranking_details(p_details, '{}'::jsonb),
    p_pattern, p_card_pattern, p_card_glow, p_chat_font
  )
  on conflict (user_id) do update set
    cover = excluded.cover,
    frame = excluded.frame,
    effect = excluded.effect,
    bubble = excluded.bubble,
    pet = excluded.pet,
    timer = excluded.timer,
    details = studylab_private.plus_ranking_details(p_details, appearance.details),
    pattern = excluded.pattern,
    card_pattern = excluded.card_pattern,
    card_glow = excluded.card_glow,
    chat_font = excluded.chat_font;
  return public.studylab_plus_profile_state(uid);
end;
$$;

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
