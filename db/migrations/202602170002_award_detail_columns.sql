begin;

alter table public.defense_money_award_transactions
  add column if not exists outlayed_amount numeric,
  add column if not exists obligated_amount numeric,
  add column if not exists potential_amount numeric,
  add column if not exists performance_start_date date,
  add column if not exists performance_current_end_date date,
  add column if not exists performance_potential_end_date date;

commit;
