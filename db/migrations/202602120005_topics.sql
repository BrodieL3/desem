begin;

create extension if not exists pgcrypto;

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  topic_type text not null check (topic_type in ('organization', 'program', 'technology', 'company', 'geography', 'acronym', 'person')),
  created_at timestamptz not null default now()
);

create table if not exists public.article_topics (
  article_id uuid not null references public.ingested_articles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  confidence numeric(4,3) not null default 0.500,
  occurrences integer not null default 1,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (article_id, topic_id)
);

create table if not exists public.user_topic_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create index if not exists article_topics_topic_id_created_at_idx
  on public.article_topics (topic_id, created_at desc);

create index if not exists article_topics_article_id_idx
  on public.article_topics (article_id);

create index if not exists user_topic_follows_user_id_idx
  on public.user_topic_follows (user_id);

create index if not exists user_topic_follows_topic_id_idx
  on public.user_topic_follows (topic_id);

alter table public.topics enable row level security;
alter table public.article_topics enable row level security;
alter table public.user_topic_follows enable row level security;

drop policy if exists "topics_read_all" on public.topics;
create policy "topics_read_all"
on public.topics
for select
to anon, authenticated
using (true);

drop policy if exists "article_topics_read_all" on public.article_topics;
create policy "article_topics_read_all"
on public.article_topics
for select
to anon, authenticated
using (true);

drop policy if exists "user_topic_follows_select_own" on public.user_topic_follows;
create policy "user_topic_follows_select_own"
on public.user_topic_follows
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_topic_follows_insert_own" on public.user_topic_follows;
create policy "user_topic_follows_insert_own"
on public.user_topic_follows
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_topic_follows_delete_own" on public.user_topic_follows;
create policy "user_topic_follows_delete_own"
on public.user_topic_follows
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_topic_follows_update_own" on public.user_topic_follows;
create policy "user_topic_follows_update_own"
on public.user_topic_follows
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

commit;
