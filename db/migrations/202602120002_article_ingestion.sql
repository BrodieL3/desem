begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.news_sources (
  id text primary key,
  name text not null,
  category text not null check (category in ('journalism', 'official', 'analysis')),
  source_badge text not null,
  feed_url text not null,
  homepage_url text not null,
  weight integer not null default 1 check (weight > 0),
  last_ingested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingested_articles (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.news_sources(id) on delete restrict,
  source_name text not null,
  source_category text not null,
  source_badge text not null,
  article_url text not null,
  canonical_url text not null,
  title text not null,
  summary text,
  author text,
  guid text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists ingested_articles_article_url_key
  on public.ingested_articles (article_url);

create unique index if not exists ingested_articles_canonical_url_key
  on public.ingested_articles (canonical_url);

create index if not exists ingested_articles_source_id_idx
  on public.ingested_articles (source_id);

create index if not exists ingested_articles_published_at_idx
  on public.ingested_articles (published_at desc);

create index if not exists ingested_articles_fetched_at_idx
  on public.ingested_articles (fetched_at desc);

drop trigger if exists news_sources_set_updated_at on public.news_sources;
create trigger news_sources_set_updated_at
before update on public.news_sources
for each row
execute function public.set_updated_at();

alter table public.news_sources enable row level security;
alter table public.ingested_articles enable row level security;

drop policy if exists "news_sources_read_all" on public.news_sources;
create policy "news_sources_read_all"
on public.news_sources
for select
to anon, authenticated
using (true);

drop policy if exists "ingested_articles_read_all" on public.ingested_articles;
create policy "ingested_articles_read_all"
on public.ingested_articles
for select
to anon, authenticated
using (true);

commit;
