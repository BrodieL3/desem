begin;

create index if not exists defense_money_market_quotes_ticker_trade_date_idx
  on public.defense_money_market_quotes (ticker, trade_date desc);

commit;
