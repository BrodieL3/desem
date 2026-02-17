begin;

create table if not exists public.macro_gpr (
  id uuid primary key default gen_random_uuid(),
  period_date date not null,
  gpr numeric(10, 4) not null,
  gprt numeric(10, 4),
  gpra numeric(10, 4),
  source_label text not null default 'Caldara & Iacoviello GPR Index',
  source_url text not null default 'https://www.matteoiacoviello.com/gpr.htm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_date)
);

create index if not exists macro_gpr_period_date_idx
  on public.macro_gpr (period_date desc);

alter table public.macro_gpr enable row level security;

drop policy if exists "macro_gpr_read_all" on public.macro_gpr;
create policy "macro_gpr_read_all"
  on public.macro_gpr
  for select to anon, authenticated using (true);

drop trigger if exists macro_gpr_set_updated_at on public.macro_gpr;
create trigger macro_gpr_set_updated_at
  before update on public.macro_gpr
  for each row execute function public.set_updated_at();

commit;
