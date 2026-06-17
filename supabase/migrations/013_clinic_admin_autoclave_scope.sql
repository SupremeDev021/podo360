create table if not exists public.autoclave_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  cycle_date date not null,
  start_time time not null,
  end_time time not null,
  cycle_number text not null,
  sterilization_lot text not null,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  responsible_name text not null,
  autoclave_name text not null,
  autoclave_code text,
  temperature text,
  pressure text,
  exposure_time text,
  cycle_type text not null check (cycle_type in ('instruments', 'dressings', 'mixed_materials', 'other')),
  chemical_indicator_result text not null check (chemical_indicator_result in ('approved', 'failed', 'not_used')),
  biological_indicator_result text not null check (biological_indicator_result in ('approved', 'failed', 'not_used', 'waiting')),
  integrator_result text not null check (integrator_result in ('approved', 'failed', 'not_used', 'waiting')),
  bowie_dick_result text not null check (bowie_dick_result in ('approved', 'failed', 'not_used', 'waiting')),
  final_result text not null check (final_result in ('approved', 'failed', 'reprocess')),
  status text not null default 'registered' check (status in ('registered', 'approved', 'failed', 'reprocess')),
  notes text,
  incidents text,
  corrective_action text,
  attachment_url text,
  attachment_path text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, cycle_number)
);

create table if not exists public.autoclave_record_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  autoclave_record_id uuid not null references public.autoclave_records(id) on delete cascade,
  material_name text not null,
  category text,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'un',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_autoclave_records_company_date
on public.autoclave_records(company_id, cycle_date desc, status);

create index if not exists idx_autoclave_record_items_company_record
on public.autoclave_record_items(company_id, autoclave_record_id);

alter table public.autoclave_records enable row level security;
alter table public.autoclave_record_items enable row level security;

create or replace function public.can_access_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_company_id() = target_company_id
$$;

drop policy if exists "clinic team reads autoclave records" on public.autoclave_records;
create policy "clinic team reads autoclave records"
on public.autoclave_records for select to authenticated
using (company_id = public.current_company_id());

drop policy if exists "authorized clinic team manages autoclave records" on public.autoclave_records;
create policy "authorized clinic team manages autoclave records"
on public.autoclave_records for all to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin', 'professional', 'stock'))
with check (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin', 'professional', 'stock'));

drop policy if exists "clinic team reads autoclave items" on public.autoclave_record_items;
create policy "clinic team reads autoclave items"
on public.autoclave_record_items for select to authenticated
using (company_id = public.current_company_id());

drop policy if exists "authorized clinic team manages autoclave items" on public.autoclave_record_items;
create policy "authorized clinic team manages autoclave items"
on public.autoclave_record_items for all to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin', 'professional', 'stock'))
with check (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin', 'professional', 'stock'));

drop trigger if exists set_updated_at on public.autoclave_records;
create trigger set_updated_at before update on public.autoclave_records
for each row execute function public.touch_updated_at();

drop trigger if exists set_updated_at on public.autoclave_record_items;
create trigger set_updated_at before update on public.autoclave_record_items
for each row execute function public.touch_updated_at();

drop policy if exists "super admins manage companies" on public.companies;
create policy "clinic owners update own company"
on public.companies for update to authenticated
using (id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin'))
with check (id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin'));

drop policy if exists "admins manage company settings" on public.company_settings;
create policy "clinic admins manage company settings"
on public.company_settings for all to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin'))
with check (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin'));

drop policy if exists "profiles are isolated" on public.profiles;
create policy "profiles are isolated"
on public.profiles for select to authenticated
using (id = auth.uid() or company_id = public.current_company_id());

drop policy if exists "admins manage company profiles" on public.profiles;
create policy "clinic admins manage company profiles"
on public.profiles for all to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin'))
with check (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin'));

drop policy if exists "users read own module permissions" on public.user_module_permissions;
create policy "users read own module permissions"
on public.user_module_permissions for select to authenticated
using (
  user_id = auth.uid()
  or (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin'))
);

drop policy if exists "admins manage module permissions" on public.user_module_permissions;
create policy "clinic admins manage module permissions"
on public.user_module_permissions for all to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin'))
with check (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin'));

drop policy if exists "authorized team manages stock" on public.stock_products;
create policy "authorized team manages stock"
on public.stock_products for all to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin', 'professional', 'stock'))
with check (company_id = public.current_company_id() and public.current_role() in ('super_admin', 'company_admin', 'professional', 'stock'));

drop policy if exists "super admins manage plans" on public.plans;
drop policy if exists "super admins manage subscriptions" on public.subscriptions;

drop policy if exists "unique records visible through own links" on public.unique_medical_records;
create policy "unique records visible through own links"
on public.unique_medical_records for select
to authenticated
using (
  exists (
    select 1 from public.patient_company_links link
    where link.unique_medical_record_id = id
      and link.company_id = public.current_company_id()
  )
  or (
    public.has_hci_view_access()
    and exists (
      select 1 from public.patient_company_links link
      where link.unique_medical_record_id = id
        and link.company_id <> public.current_company_id()
        and public.has_hci_enabled(link.company_id)
        and public.has_hci_enabled(public.current_company_id())
    )
  )
);

drop policy if exists "patient company links visible to linked company" on public.patient_company_links;
create policy "patient company links visible to linked company"
on public.patient_company_links for select
to authenticated
using (company_id = public.current_company_id());

drop policy if exists "hci consents visible to related companies" on public.hci_patient_consents;
create policy "hci consents visible to related companies"
on public.hci_patient_consents for select
to authenticated
using (public.current_company_id() in (requester_company_id, source_company_id));

drop policy if exists "hci logs visible to admins" on public.hci_access_logs;
create policy "hci logs visible to admins"
on public.hci_access_logs for select
to authenticated
using (public.current_company_id() = requester_company_id and public.current_role() in ('super_admin', 'company_admin'));

drop policy if exists "admins upload company assets" on storage.objects;
create policy "admins upload company assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.current_role() in ('super_admin', 'company_admin')
);

drop policy if exists "admins update company assets" on storage.objects;
create policy "admins update company assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.current_role() in ('super_admin', 'company_admin')
)
with check (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.current_role() in ('super_admin', 'company_admin')
);

drop policy if exists "admins delete company assets" on storage.objects;
create policy "admins delete company assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.current_role() in ('super_admin', 'company_admin')
);
