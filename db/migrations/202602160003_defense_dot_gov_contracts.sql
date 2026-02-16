begin;

create table if not exists public.defense_dot_gov_daily_contracts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.defense_money_runs(id) on delete set null,
  announcement_date date not null,
  contract_number text not null,
  contractor_name text not null,
  awarding_agency text not null,
  award_amount numeric(16, 2) not null,
  location text,
  description text not null,
  bucket_primary text not null check (bucket_primary in ('ai_ml', 'c5isr', 'space', 'autonomy', 'cyber', 'munitions', 'ew', 'counter_uas')),
  bucket_tags text[] not null default '{}',
  source_url text not null,
  raw_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (announcement_date, contract_number, contractor_name)
);

create index if not exists defense_dot_gov_contracts_date_idx
  on public.defense_dot_gov_daily_contracts (announcement_date desc);

create index if not exists defense_dot_gov_contracts_contractor_idx
  on public.defense_dot_gov_daily_contracts (contractor_name);

create index if not exists defense_dot_gov_contracts_bucket_idx
  on public.defense_dot_gov_daily_contracts (bucket_primary);

drop trigger if exists defense_dot_gov_contracts_set_updated_at on public.defense_dot_gov_daily_contracts;
create trigger defense_dot_gov_contracts_set_updated_at
  before update on public.defense_dot_gov_daily_contracts
  for each row execute function public.set_updated_at();

alter table public.defense_dot_gov_daily_contracts enable row level security;

drop policy if exists "defense_dot_gov_contracts_read_all" on public.defense_dot_gov_daily_contracts;
create policy "defense_dot_gov_contracts_read_all"
  on public.defense_dot_gov_daily_contracts
  for select to anon, authenticated using (true);

commit;
