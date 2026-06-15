alter type public.user_role add value if not exists 'stock';
alter type public.user_role add value if not exists 'schedule';
alter type public.user_role add value if not exists 'reports';
alter type public.user_role add value if not exists 'custom';

alter table public.appointments
  add column if not exists marked_absent_at timestamptz,
  add column if not exists marked_absent_by uuid references public.profiles(id) on delete set null,
  add column if not exists absence_notes text;

create unique index if not exists idx_stock_products_company_normalized_name
on public.stock_products (company_id, lower(trim(name)));

create table if not exists public.user_module_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  module_key text not null,
  can_view boolean not null default true,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_id, module_key)
);

alter table public.user_module_permissions enable row level security;

drop policy if exists "users read own module permissions" on public.user_module_permissions;
create policy "users read own module permissions"
on public.user_module_permissions for select to authenticated
using (
  public.is_super_admin()
  or user_id = auth.uid()
  or (company_id = public.current_company_id() and public.current_role() = 'company_admin')
);

drop policy if exists "admins manage module permissions" on public.user_module_permissions;
create policy "admins manage module permissions"
on public.user_module_permissions for all to authenticated
using (
  public.is_super_admin()
  or (company_id = public.current_company_id() and public.current_role() = 'company_admin')
)
with check (
  public.is_super_admin()
  or (company_id = public.current_company_id() and public.current_role() = 'company_admin')
);

drop trigger if exists set_updated_at on public.user_module_permissions;
create trigger set_updated_at before update on public.user_module_permissions
for each row execute function public.touch_updated_at();
