-- Additive per-announcement design settings. Existing rows use an empty object.
-- RLS, admin policies, existing image path and enum constraints stay unchanged.
begin;
alter table public.studylab_announcements add column if not exists design jsonb not null default '{}'::jsonb;
alter table public.studylab_announcements add constraint announcement_design_safe check (
 jsonb_typeof(design)='object' and octet_length(design::text)<=5000
 and design - array['layout','preset','badge','icon','color','button_shape','button_size','media_url','dp_url','dp_shape','dp_size','bg_fit','bg_x','bg_y','bg_zoom','dp_fit']::text[] = '{}'::jsonb
 and coalesce(design->>'layout','classic') in ('classic','clean-text','profile','clean-image')
 and coalesce(design->>'preset','') in ('','telegram','resource','sponsored','custom')
 and char_length(coalesce(design->>'badge',''))<=36
 and coalesce(design->>'badge','') !~ '[[:cntrl:]]'
 and coalesce(design->>'icon','arrow') in ('arrow','telegram','download','book','link','play','chat','profile','none')
 and coalesce(design->>'color','default') in ('default','blue','green','purple','orange','neutral')
 and coalesce(design->>'button_shape','pill') in ('pill','rounded')
 and coalesce(design->>'button_size','normal') in ('compact','normal','large')
 and coalesce(design->>'dp_shape','square') in ('square','round')
 and coalesce(design->>'bg_fit','cover') in ('cover','contain')
 and coalesce(design->>'dp_fit','cover') in ('cover','contain')
 and (not design ? 'dp_size' or coalesce(design->>'dp_size','') ~ '^(4[5-9]|[5-8][0-9]|9[0-5])$')
 and (not design ? 'bg_x' or coalesce(design->>'bg_x','') ~ '^([0-9]|[1-9][0-9]|100)$')
 and (not design ? 'bg_y' or coalesce(design->>'bg_y','') ~ '^([0-9]|[1-9][0-9]|100)$')
 and (not design ? 'bg_zoom' or coalesce(design->>'bg_zoom','') ~ '^(1[0-7][0-9]|180)$')
 and (not design ? 'media_url' or coalesce(design->>'media_url','') ~* '^https://zpvatyxdbshjuqgtexzw[.]supabase[.]co/storage/v1/object/public/studylab-admin-media/uploads/[a-z0-9_-]+[.](jpg|jpeg|png|webp)$')
 and (not design ? 'dp_url' or coalesce(design->>'dp_url','') ~* '^https://zpvatyxdbshjuqgtexzw[.]supabase[.]co/storage/v1/object/public/studylab-admin-media/uploads/[a-z0-9_-]+[.](jpg|jpeg|png|webp)$')
 and (coalesce(design->>'layout','classic')<>'clean-image' or design ? 'media_url' or image_path is not null)
 and (coalesce(design->>'layout','classic')<>'profile' or design ? 'media_url' or design ? 'dp_url' or image_path is not null)
);
commit;
