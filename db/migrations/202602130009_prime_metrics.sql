begin;

create extension if not exists pgcrypto;

create table if not exists public.prime_companies (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  name text not null,
  cik text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prime_reporting_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.prime_companies(id) on delete cascade,
  fiscal_year integer not null,
  fiscal_quarter integer not null check (fiscal_quarter between 1 and 4),
  period_end date not null,
  filing_type text not null check (filing_type in ('10-Q', '10-K', '8-K', 'IR_RELEASE')),
  filing_date date not null,
  source_url text not null,
  accession_no text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, fiscal_year, fiscal_quarter)
);

create table if not exists public.prime_metric_points (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.prime_reporting_periods(id) on delete cascade,
  metric_key text not null check (metric_key in ('backlog_total_b', 'book_to_bill', 'revenue_b', 'orders_b')),
  value_num numeric(16,4),
  unit text not null default 'raw',
  disclosure_status text not null default 'not_disclosed' check (disclosure_status in ('disclosed', 'not_disclosed')),
  source_url text,
  source_note text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (period_id, metric_key)
);

create table if not exists public.prime_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null default 'manual',
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  processed_companies integer not null default 0,
  processed_periods integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prime_relationship_events (
  id uuid primary key default gen_random_uuid(),
  prime_company_id uuid not null references public.prime_companies(id) on delete cascade,
  partner_name text not null,
  partner_ticker text,
  relationship_type text not null default 'other' check (relationship_type in ('teaming', 'joint_venture', 'subcontract', 'supplier', 'other')),
  event_date date,
  source_url text,
  evidence_note text,
  confidence numeric(4,3) not null default 0.500,
  status text not null default 'candidate' check (status in ('candidate', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prime_reporting_periods_company_period_idx
  on public.prime_reporting_periods (company_id, period_end desc);

create index if not exists prime_metric_points_metric_period_idx
  on public.prime_metric_points (metric_key, period_id);

create index if not exists prime_metric_points_metric_disclosure_idx
  on public.prime_metric_points (metric_key, disclosure_status);

create index if not exists prime_ingestion_runs_started_at_idx
  on public.prime_ingestion_runs (started_at desc);

create index if not exists prime_relationship_events_company_event_date_idx
  on public.prime_relationship_events (prime_company_id, event_date desc);

create index if not exists prime_relationship_events_status_idx
  on public.prime_relationship_events (status);

drop trigger if exists prime_companies_set_updated_at on public.prime_companies;
create trigger prime_companies_set_updated_at
before update on public.prime_companies
for each row
execute function public.set_updated_at();

drop trigger if exists prime_reporting_periods_set_updated_at on public.prime_reporting_periods;
create trigger prime_reporting_periods_set_updated_at
before update on public.prime_reporting_periods
for each row
execute function public.set_updated_at();

drop trigger if exists prime_metric_points_set_updated_at on public.prime_metric_points;
create trigger prime_metric_points_set_updated_at
before update on public.prime_metric_points
for each row
execute function public.set_updated_at();

drop trigger if exists prime_ingestion_runs_set_updated_at on public.prime_ingestion_runs;
create trigger prime_ingestion_runs_set_updated_at
before update on public.prime_ingestion_runs
for each row
execute function public.set_updated_at();

drop trigger if exists prime_relationship_events_set_updated_at on public.prime_relationship_events;
create trigger prime_relationship_events_set_updated_at
before update on public.prime_relationship_events
for each row
execute function public.set_updated_at();

alter table public.prime_companies enable row level security;
alter table public.prime_reporting_periods enable row level security;
alter table public.prime_metric_points enable row level security;
alter table public.prime_ingestion_runs enable row level security;
alter table public.prime_relationship_events enable row level security;

drop policy if exists "prime_companies_read_all" on public.prime_companies;
create policy "prime_companies_read_all"
on public.prime_companies
for select
to anon, authenticated
using (true);

drop policy if exists "prime_reporting_periods_read_all" on public.prime_reporting_periods;
create policy "prime_reporting_periods_read_all"
on public.prime_reporting_periods
for select
to anon, authenticated
using (true);

drop policy if exists "prime_metric_points_read_all" on public.prime_metric_points;
create policy "prime_metric_points_read_all"
on public.prime_metric_points
for select
to anon, authenticated
using (true);

drop policy if exists "prime_ingestion_runs_read_all" on public.prime_ingestion_runs;
create policy "prime_ingestion_runs_read_all"
on public.prime_ingestion_runs
for select
to anon, authenticated
using (true);

drop policy if exists "prime_relationship_events_read_all" on public.prime_relationship_events;
create policy "prime_relationship_events_read_all"
on public.prime_relationship_events
for select
to anon, authenticated
using (true);

commit;
