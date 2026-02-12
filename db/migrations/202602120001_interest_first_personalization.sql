begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  onboarding_completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'interest_type'
  ) then
    create type public.interest_type as enum ('mission', 'domain', 'tech');
  end if;
end
$$;

create table if not exists public.user_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  interest_type public.interest_type not null,
  interest_value text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists user_interests_user_id_interest_value_key
  on public.user_interests (user_id, interest_type, interest_value);

create index if not exists user_interests_user_id_idx
  on public.user_interests (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_interests enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using (auth.uid() = id);

drop policy if exists "user_interests_select_own" on public.user_interests;
create policy "user_interests_select_own"
on public.user_interests
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_interests_insert_own" on public.user_interests;
create policy "user_interests_insert_own"
on public.user_interests
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_interests_delete_own" on public.user_interests;
create policy "user_interests_delete_own"
on public.user_interests
for delete
to authenticated
using (auth.uid() = user_id);

commit;
