begin;

-- Add modification_number to distinguish initial awards (mod='0') from
-- contract modifications (e.g. 'P00001', 'P00002').
-- This lets the award chart show only new contracts by default while
-- still keeping modification history available for drill-down.
alter table public.defense_money_award_transactions
  add column if not exists modification_number text;

-- Index for filtering to initial awards only on the chart query
create index if not exists defense_money_award_transactions_mod_number_idx
  on public.defense_money_award_transactions (modification_number);

commit;
