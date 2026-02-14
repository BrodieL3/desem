begin;

alter table public.news_sources
  add column if not exists quality_tier text not null default 'medium';

alter table public.news_sources
  add column if not exists bias text not null default 'center';

alter table public.news_sources
  add column if not exists update_cadence text not null default 'daily';

alter table public.news_sources
  add column if not exists story_role text not null default 'reporting';

alter table public.news_sources
  add column if not exists topic_focus text[] not null default '{}';

alter table public.news_sources
  drop constraint if exists news_sources_quality_tier_check;

alter table public.news_sources
  add constraint news_sources_quality_tier_check check (quality_tier in ('high', 'medium', 'baseline'));

alter table public.news_sources
  drop constraint if exists news_sources_bias_check;

alter table public.news_sources
  add constraint news_sources_bias_check check (bias in ('center', 'center-left', 'center-right', 'official'));

alter table public.news_sources
  drop constraint if exists news_sources_update_cadence_check;

alter table public.news_sources
  add constraint news_sources_update_cadence_check check (update_cadence in ('hourly', 'daily', 'weekly'));

alter table public.news_sources
  drop constraint if exists news_sources_story_role_check;

alter table public.news_sources
  add constraint news_sources_story_role_check check (story_role in ('reporting', 'analysis', 'official', 'opinion'));

commit;
