alter table public.profiles
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references public.profiles(id) on delete set null;

alter table public.appointments
  add column if not exists payer_type text not null default 'private' check (payer_type in ('private', 'insurance')),
  add column if not exists insurance_name text;

alter table public.attendances
  add column if not exists payer_type text not null default 'private' check (payer_type in ('private', 'insurance')),
  add column if not exists insurance_name text;

alter table public.stock_products
  add column if not exists active boolean not null default true;

alter table public.financial_transactions
  add column if not exists ba_number text,
  add column if not exists unique_medical_record_id uuid references public.unique_medical_records(id) on delete set null,
  add column if not exists payer_type text not null default 'private' check (payer_type in ('private', 'insurance')),
  add column if not exists insurance_name text;

alter table public.company_settings
  add column if not exists auto_financial_on_finish boolean not null default false,
  add column if not exists require_financial_confirmation boolean not null default true,
  add column if not exists include_products_in_financial boolean not null default true,
  add column if not exists include_procedures_in_financial boolean not null default true;

create index if not exists idx_financial_company_attendance
on public.financial_transactions(company_id, attendance_id);
