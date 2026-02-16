begin;

create table if not exists public.sam_gov_opportunities (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.defense_money_runs(id) on delete set null,
  opportunity_id text not null unique,
  notice_type text not null check (notice_type in ('presolicitation', 'solicitation', 'award', 'special_notice')),
  title text not null,
  solicitation_number text,
  department text,
  sub_tier text,
  office text,
  posted_date date not null,
  response_deadline date,
  archive_date date,
  naics_code text,
  classification_code text,
  set_aside text,
  description text,
  estimated_value_low numeric(16, 2),
  estimated_value_high numeric(16, 2),
  bucket_primary text check (bucket_primary in ('ai_ml', 'c5isr', 'space', 'autonomy', 'cyber', 'munitions', 'ew', 'counter_uas')),
  bucket_tags text[] not null default '{}',
  source_url text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sam_gov_opportunities_posted_date_idx
  on public.sam_gov_opportunities (posted_date desc);

create index if not exists sam_gov_opportunities_response_deadline_idx
  on public.sam_gov_opportunities (response_deadline);

create index if not exists sam_gov_opportunities_notice_type_idx
  on public.sam_gov_opportunities (notice_type);

create index if not exists sam_gov_opportunities_bucket_idx
  on public.sam_gov_opportunities (bucket_primary);

drop trigger if exists sam_gov_opportunities_set_updated_at on public.sam_gov_opportunities;
create trigger sam_gov_opportunities_set_updated_at
  before update on public.sam_gov_opportunities
  for each row execute function public.set_updated_at();

alter table public.sam_gov_opportunities enable row level security;

drop policy if exists "sam_gov_opportunities_read_all" on public.sam_gov_opportunities;
create policy "sam_gov_opportunities_read_all"
  on public.sam_gov_opportunities
  for select to anon, authenticated using (true);

commit;
