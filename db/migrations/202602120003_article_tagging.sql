begin;

alter table public.ingested_articles
  add column if not exists mission_tags text[] not null default '{}',
  add column if not exists domain_tags text[] not null default '{}',
  add column if not exists technology_tags text[] not null default '{}',
  add column if not exists track text,
  add column if not exists content_type text,
  add column if not exists high_impact boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ingested_articles_track_check'
  ) then
    alter table public.ingested_articles
      add constraint ingested_articles_track_check
      check (track is null or track in ('macro', 'programs', 'tech', 'capital'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ingested_articles_content_type_check'
  ) then
    alter table public.ingested_articles
      add constraint ingested_articles_content_type_check
      check (content_type is null or content_type in ('conflict', 'program', 'budget', 'policy', 'funding', 'tech'));
  end if;
end;
$$;

create index if not exists ingested_articles_mission_tags_gin_idx
  on public.ingested_articles
  using gin (mission_tags);

create index if not exists ingested_articles_domain_tags_gin_idx
  on public.ingested_articles
  using gin (domain_tags);

create index if not exists ingested_articles_technology_tags_gin_idx
  on public.ingested_articles
  using gin (technology_tags);

create index if not exists ingested_articles_track_idx
  on public.ingested_articles (track);

create index if not exists ingested_articles_content_type_idx
  on public.ingested_articles (content_type);

commit;
