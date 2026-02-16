begin;

create table if not exists public.article_contract_links (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null,
  contract_source text not null check (contract_source in ('usaspending', 'defense_gov')),
  contract_id text not null,
  match_type text not null check (match_type in ('company_name', 'program_keyword', 'manual')),
  match_confidence numeric(3, 2) not null check (match_confidence >= 0 and match_confidence <= 1),
  created_at timestamptz not null default now(),
  unique (article_id, contract_source, contract_id)
);

create index if not exists article_contract_links_article_idx
  on public.article_contract_links (article_id);

create index if not exists article_contract_links_contract_idx
  on public.article_contract_links (contract_source, contract_id);

alter table public.article_contract_links enable row level security;

drop policy if exists "article_contract_links_read_all" on public.article_contract_links;
create policy "article_contract_links_read_all"
  on public.article_contract_links
  for select to anon, authenticated using (true);

commit;
