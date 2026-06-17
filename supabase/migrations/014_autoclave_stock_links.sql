alter table public.autoclave_records
  add column if not exists autoclave_product_id uuid references public.stock_products(id) on delete set null;

alter table public.autoclave_record_items
  add column if not exists stock_product_id uuid references public.stock_products(id) on delete set null,
  add column if not exists stock_product_code text;

create index if not exists idx_autoclave_records_equipment
on public.autoclave_records(company_id, autoclave_product_id);

create index if not exists idx_autoclave_items_stock_product
on public.autoclave_record_items(company_id, stock_product_id);
