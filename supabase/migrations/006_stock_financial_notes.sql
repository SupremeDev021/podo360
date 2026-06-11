alter table public.stock_products
  add column if not exists notes text;

alter table public.financial_transactions
  add column if not exists notes text;
