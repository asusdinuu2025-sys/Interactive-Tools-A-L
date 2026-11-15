-- StudyLab announcements customization only: keep existing rows/images/RLS unchanged.
alter table public.studylab_announcements
  drop constraint if exists announcement_art_key_safe;
alter table public.studylab_announcements
  add constraint announcement_art_key_safe
  check (art_key in ('none','profile','social','room','chat','science','about','announcement'));

alter table public.studylab_announcements
  drop constraint if exists studylab_announcements_target_path_check;
alter table public.studylab_announcements
  add constraint studylab_announcements_target_path_check check (
    char_length(target_path) between 2 and 2048
    and target_path !~ '[[:cntrl:]]'
    and (
      (target_path like '/%' and target_path not like '//%')
      or target_path ~* '^https?://[^/[:space:]?#]+([/?#][^[:space:]]*)?$'
    )
  );

alter table public.studylab_announcements
  add column if not exists display_seconds smallint not null default 4,
  add column if not exists transition_style text not null default 'fade',
  add column if not exists display_mode text not null default 'standard';

alter table public.studylab_announcements
  add constraint announcement_display_seconds_safe check (display_seconds between 1 and 10),
  add constraint announcement_transition_style_safe
    check (transition_style in ('fade','slide','dissolve','zoom','none')),
  add constraint announcement_display_mode_safe
    check (display_mode in ('standard','image')),
  add constraint announcement_image_mode_requires_image
    check (display_mode <> 'image' or image_path is not null);

comment on column public.studylab_announcements.display_seconds
  is 'Per-banner auto-rotation dwell time in seconds (1-10).';
comment on column public.studylab_announcements.transition_style
  is 'Outgoing slide effect: fade, slide, dissolve, zoom, or none.';
comment on column public.studylab_announcements.display_mode
  is 'standard = text and art overlay; image = clean image-only banner.';
