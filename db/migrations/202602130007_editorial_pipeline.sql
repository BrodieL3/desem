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

create table if not exists public.editorial_generation_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null default 'cron',
  fetched_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  article_count integer not null default 0,
  cluster_count integer not null default 0,
  transform_attempted_count integer not null default 0,
  transform_success_count integer not null default 0,
  transform_failed_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_clusters (
  id uuid primary key default gen_random_uuid(),
  cluster_key text not null unique,
  representative_article_id uuid references public.ingested_articles(id) on delete set null,
  headline text not null,
  topic_label text,
  article_count_24h integer not null default 0,
  unique_sources_24h integer not null default 0,
  congestion_score numeric(6,3) not null default 0,
  is_congested boolean not null default false,
  transform_attempted boolean not null default false,
  transform_status text not null default 'skipped' check (transform_status in ('skipped', 'succeeded', 'failed')),
  generation_mode text not null default 'deterministic' check (generation_mode in ('deterministic', 'transform')),
  review_status text not null default 'needs_review' check (review_status in ('needs_review', 'approved', 'published')),
  last_generated_run_id uuid references public.editorial_generation_runs(id) on delete set null,
  last_generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cluster_members (
  cluster_id uuid not null references public.story_clusters(id) on delete cascade,
  article_id uuid not null references public.ingested_articles(id) on delete cascade,
  similarity numeric(6,3) not null default 0,
  is_representative boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (cluster_id, article_id)
);

create index if not exists editorial_generation_runs_started_at_idx
  on public.editorial_generation_runs (started_at desc);

create index if not exists story_clusters_last_generated_at_idx
  on public.story_clusters (last_generated_at desc);

create index if not exists story_clusters_congested_idx
  on public.story_clusters (is_congested, last_generated_at desc);

create index if not exists cluster_members_article_id_idx
  on public.cluster_members (article_id);

create index if not exists cluster_members_cluster_id_idx
  on public.cluster_members (cluster_id);

drop trigger if exists editorial_generation_runs_set_updated_at on public.editorial_generation_runs;
create trigger editorial_generation_runs_set_updated_at
before update on public.editorial_generation_runs
for each row
execute function public.set_updated_at();

drop trigger if exists story_clusters_set_updated_at on public.story_clusters;
create trigger story_clusters_set_updated_at
before update on public.story_clusters
for each row
execute function public.set_updated_at();

alter table public.editorial_generation_runs enable row level security;
alter table public.story_clusters enable row level security;
alter table public.cluster_members enable row level security;

drop policy if exists "editorial_generation_runs_read_all" on public.editorial_generation_runs;
create policy "editorial_generation_runs_read_all"
on public.editorial_generation_runs
for select
to anon, authenticated
using (true);

drop policy if exists "story_clusters_read_all" on public.story_clusters;
create policy "story_clusters_read_all"
on public.story_clusters
for select
to anon, authenticated
using (true);

drop policy if exists "cluster_members_read_all" on public.cluster_members;
create policy "cluster_members_read_all"
on public.cluster_members
for select
to anon, authenticated
using (true);

commit;
