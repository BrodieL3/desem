begin;

create extension if not exists pgcrypto;

create table if not exists public.defense_money_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null default 'manual',
  status text not null default 'running' check (status in ('running', 'succeeded', 'partial_failed', 'failed')),
  target_date date,
  processed_transactions integer not null default 0,
  processed_tickers integer not null default 0,
  processed_briefs integer not null default 0,
  error_summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.defense_money_award_transactions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.defense_money_runs(id) on delete set null,
  generated_internal_id text not null unique,
  action_date date not null,
  award_id text not null,
  recipient_name text not null,
  awarding_agency_name text not null,
  transaction_amount numeric(16, 2) not null,
  naics_code text,
  psc_code text,
  transaction_description text,
  bucket_primary text not null check (bucket_primary in ('ai_ml', 'c5isr', 'space', 'autonomy', 'cyber', 'munitions', 'ew', 'counter_uas')),
  bucket_tags text[] not null default '{}',
  source_url text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.defense_money_market_quotes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.defense_money_runs(id) on delete set null,
  trade_date date not null,
  ticker text not null,
  price numeric(16, 4),
  change_num numeric(16, 4),
  change_percent numeric(10, 4),
  high numeric(16, 4),
  low numeric(16, 4),
  open numeric(16, 4),
  previous_close numeric(16, 4),
  source_url text,
  context_headline text,
  context_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trade_date, ticker)
);

create table if not exists public.defense_money_briefs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.defense_money_runs(id) on delete set null,
  brief_date date not null,
  timeframe text not null check (timeframe in ('daily', 'weekly', 'monthly')),
  card_key text not null,
  generated_mode text not null default 'deterministic' check (generated_mode in ('deterministic', 'llm')),
  action_lens text not null check (action_lens in ('build', 'sell', 'partner')),
  summary text not null,
  so_what text not null,
  citations jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brief_date, timeframe, card_key)
);

create table if not exists public.defense_money_rollups (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.defense_money_runs(id) on delete set null,
  period_type text not null check (period_type in ('week', 'month')),
  period_start date not null,
  period_end date not null,
  total_obligations numeric(18, 2) not null default 0,
  award_count integer not null default 0,
  top5_concentration numeric(8, 4),
  category_share jsonb not null default '{}'::jsonb,
  top_recipients jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_type, period_start, period_end)
);

create table if not exists public.defense_money_macro_context (
  id uuid primary key default gen_random_uuid(),
  effective_week_start date not null unique,
  headline text not null,
  summary text not null,
  so_what text not null,
  source_label text not null,
  source_url text not null,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.defense_money_backfill_checkpoints (
  id uuid primary key default gen_random_uuid(),
  checkpoint_key text not null unique,
  cursor_date date,
  cursor_page integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists defense_money_runs_started_at_idx
  on public.defense_money_runs (started_at desc);

create index if not exists defense_money_award_transactions_action_date_idx
  on public.defense_money_award_transactions (action_date desc);

create index if not exists defense_money_award_transactions_bucket_idx
  on public.defense_money_award_transactions (bucket_primary);

create index if not exists defense_money_award_transactions_recipient_idx
  on public.defense_money_award_transactions (recipient_name);

create index if not exists defense_money_market_quotes_trade_date_idx
  on public.defense_money_market_quotes (trade_date desc, ticker);

create index if not exists defense_money_briefs_date_idx
  on public.defense_money_briefs (brief_date desc, timeframe);

create index if not exists defense_money_rollups_period_idx
  on public.defense_money_rollups (period_type, period_start desc);

create index if not exists defense_money_macro_context_effective_idx
  on public.defense_money_macro_context (effective_week_start desc);

create index if not exists defense_money_backfill_checkpoints_key_idx
  on public.defense_money_backfill_checkpoints (checkpoint_key);

drop trigger if exists defense_money_runs_set_updated_at on public.defense_money_runs;
create trigger defense_money_runs_set_updated_at
before update on public.defense_money_runs
for each row
execute function public.set_updated_at();

drop trigger if exists defense_money_award_transactions_set_updated_at on public.defense_money_award_transactions;
create trigger defense_money_award_transactions_set_updated_at
before update on public.defense_money_award_transactions
for each row
execute function public.set_updated_at();

drop trigger if exists defense_money_market_quotes_set_updated_at on public.defense_money_market_quotes;
create trigger defense_money_market_quotes_set_updated_at
before update on public.defense_money_market_quotes
for each row
execute function public.set_updated_at();

drop trigger if exists defense_money_briefs_set_updated_at on public.defense_money_briefs;
create trigger defense_money_briefs_set_updated_at
before update on public.defense_money_briefs
for each row
execute function public.set_updated_at();

drop trigger if exists defense_money_rollups_set_updated_at on public.defense_money_rollups;
create trigger defense_money_rollups_set_updated_at
before update on public.defense_money_rollups
for each row
execute function public.set_updated_at();

drop trigger if exists defense_money_macro_context_set_updated_at on public.defense_money_macro_context;
create trigger defense_money_macro_context_set_updated_at
before update on public.defense_money_macro_context
for each row
execute function public.set_updated_at();

drop trigger if exists defense_money_backfill_checkpoints_set_updated_at on public.defense_money_backfill_checkpoints;
create trigger defense_money_backfill_checkpoints_set_updated_at
before update on public.defense_money_backfill_checkpoints
for each row
execute function public.set_updated_at();

alter table public.defense_money_runs enable row level security;
alter table public.defense_money_award_transactions enable row level security;
alter table public.defense_money_market_quotes enable row level security;
alter table public.defense_money_briefs enable row level security;
alter table public.defense_money_rollups enable row level security;
alter table public.defense_money_macro_context enable row level security;
alter table public.defense_money_backfill_checkpoints enable row level security;

drop policy if exists "defense_money_runs_read_all" on public.defense_money_runs;
create policy "defense_money_runs_read_all"
on public.defense_money_runs
for select
to anon, authenticated
using (true);

drop policy if exists "defense_money_award_transactions_read_all" on public.defense_money_award_transactions;
create policy "defense_money_award_transactions_read_all"
on public.defense_money_award_transactions
for select
to anon, authenticated
using (true);

drop policy if exists "defense_money_market_quotes_read_all" on public.defense_money_market_quotes;
create policy "defense_money_market_quotes_read_all"
on public.defense_money_market_quotes
for select
to anon, authenticated
using (true);

drop policy if exists "defense_money_briefs_read_all" on public.defense_money_briefs;
create policy "defense_money_briefs_read_all"
on public.defense_money_briefs
for select
to anon, authenticated
using (true);

drop policy if exists "defense_money_rollups_read_all" on public.defense_money_rollups;
create policy "defense_money_rollups_read_all"
on public.defense_money_rollups
for select
to anon, authenticated
using (true);

drop policy if exists "defense_money_macro_context_read_all" on public.defense_money_macro_context;
create policy "defense_money_macro_context_read_all"
on public.defense_money_macro_context
for select
to anon, authenticated
using (true);

drop policy if exists "defense_money_backfill_checkpoints_read_all" on public.defense_money_backfill_checkpoints;
create policy "defense_money_backfill_checkpoints_read_all"
on public.defense_money_backfill_checkpoints
for select
to anon, authenticated
using (true);

commit;
