alter table public.stock_products
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create table if not exists public.attendance_used_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  unique_medical_record_id uuid not null references public.unique_medical_records(id) on delete cascade,
  attendance_id uuid not null references public.attendances(id) on delete cascade,
  anamnesis_record_id uuid references public.anamnesis_records(id) on delete cascade,
  ba_number text not null,
  product_id uuid references public.stock_products(id) on delete set null,
  product_name text not null,
  category_name text,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'un',
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_attendance_used_products_company_attendance
on public.attendance_used_products(company_id, attendance_id);

alter table public.attendance_used_products enable row level security;

create policy "attendance used products are isolated"
on public.attendance_used_products for select to authenticated
using (public.can_access_company(company_id) and public.current_role() <> 'financial');

create policy "clinical team manages attendance used products"
on public.attendance_used_products for all to authenticated
using (company_id = public.current_company_id() and public.has_clinical_write_access())
with check (company_id = public.current_company_id() and public.has_clinical_write_access());

drop trigger if exists set_updated_at on public.attendance_used_products;
create trigger set_updated_at before update on public.attendance_used_products
for each row execute function public.touch_updated_at();

drop policy if exists "admins and professionals manage stock" on public.stock_products;
create policy "authorized team manages stock"
on public.stock_products for all to authenticated
using (public.is_super_admin() or (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional', 'stock')))
with check (public.is_super_admin() or (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional', 'stock')));
