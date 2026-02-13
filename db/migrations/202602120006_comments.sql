begin;

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists role text not null default 'user';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('user', 'moderator'));
  end if;
end;
$$;

create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.ingested_articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.article_comments(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_user_id)
);

create index if not exists article_comments_article_id_created_at_idx
  on public.article_comments (article_id, created_at desc);

create index if not exists article_comments_user_id_idx
  on public.article_comments (user_id);

create index if not exists comment_reports_comment_id_idx
  on public.comment_reports (comment_id);

create index if not exists comment_reports_reporter_user_id_idx
  on public.comment_reports (reporter_user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists article_comments_set_updated_at on public.article_comments;
create trigger article_comments_set_updated_at
before update on public.article_comments
for each row
execute function public.set_updated_at();

alter table public.article_comments enable row level security;
alter table public.comment_reports enable row level security;

drop policy if exists "article_comments_read_active" on public.article_comments;
create policy "article_comments_read_active"
on public.article_comments
for select
to anon, authenticated
using (status = 'active');

drop policy if exists "article_comments_insert_own" on public.article_comments;
create policy "article_comments_insert_own"
on public.article_comments
for insert
to authenticated
with check (
  auth.uid() = user_id
  and status = 'active'
  and char_length(trim(body)) > 0
);

drop policy if exists "article_comments_update_own" on public.article_comments;
create policy "article_comments_update_own"
on public.article_comments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "comment_reports_select_own" on public.comment_reports;
create policy "comment_reports_select_own"
on public.comment_reports
for select
to authenticated
using (auth.uid() = reporter_user_id);

drop policy if exists "comment_reports_insert_own" on public.comment_reports;
create policy "comment_reports_insert_own"
on public.comment_reports
for insert
to authenticated
with check (
  auth.uid() = reporter_user_id
  and char_length(trim(reason)) > 0
);

commit;
