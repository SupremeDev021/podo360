create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('super_admin', 'company_admin', 'professional', 'reception', 'financial');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.plan_status as enum ('trial', 'active', 'past_due', 'blocked', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.appointment_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('paid', 'pending', 'overdue', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum ('pix', 'cash', 'credit_card', 'debit_card', 'insurance', 'other');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  monthly_price numeric(12,2) not null default 0,
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  document text,
  contact_email text,
  contact_phone text,
  plan_id uuid references public.plans(id),
  plan_status public.plan_status not null default 'trial',
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  display_name text not null,
  logo_url text,
  primary_color text not null default '#0f766e',
  secondary_color text not null default '#155e75',
  accent_color text not null default '#f59e0b',
  commercial_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  full_name text not null,
  email text not null,
  role public.user_role not null default 'reception',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status public.plan_status not null default 'trial',
  current_period_start date,
  current_period_end date,
  external_customer_id text,
  external_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  cpf text,
  rg text,
  birth_date date,
  phone text,
  whatsapp text,
  email text,
  address text,
  profession text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_clinical_data (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  chief_complaint text,
  disease_history text,
  diabetes boolean not null default false,
  hypertension boolean not null default false,
  medications text,
  allergies text,
  previous_surgeries text,
  vascular_problems text,
  dermatological_problems text,
  clinical_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_id uuid references public.profiles(id),
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 50,
  status public.appointment_status not null default 'scheduled',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_id uuid references public.profiles(id),
  attended_at timestamptz not null default now(),
  type text,
  procedure_performed text,
  patient_complaint text,
  clinical_evaluation text,
  conduct_performed text,
  products_used jsonb not null default '[]'::jsonb,
  notes text,
  recommended_return date,
  status public.appointment_status not null default 'completed',
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  attendance_id uuid references public.attendances(id) on delete cascade,
  event_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  attendance_id uuid references public.attendances(id) on delete set null,
  description text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null,
  due_date date,
  paid_at date,
  payment_method public.payment_method not null default 'pix',
  category text,
  status public.payment_status not null default 'pending',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  category text,
  internal_code text,
  current_quantity numeric(12,3) not null default 0,
  minimum_quantity numeric(12,3) not null default 0,
  unit text not null default 'un',
  cost_value numeric(12,2) not null default 0,
  sale_value numeric(12,2) not null default 0,
  supplier text,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.stock_products(id) on delete cascade,
  attendance_id uuid references public.attendances(id) on delete set null,
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment')),
  quantity numeric(12,3) not null,
  unit_cost numeric(12,2),
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  attendance_id uuid references public.attendances(id) on delete set null,
  report_type text not null,
  title text not null,
  content text not null,
  filters jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_referral_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  attendance_id uuid references public.attendances(id) on delete set null,
  prompt jsonb not null default '{}'::jsonb,
  content text not null,
  status text not null default 'draft' check (status in ('draft', 'saved', 'exported')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_body_maps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  attendance_id uuid references public.attendances(id) on delete set null,
  body_region text not null,
  body_side text not null check (body_side in ('right', 'left', 'bilateral', 'not_applicable')),
  region_key text not null,
  coordinates jsonb,
  dressing_type text,
  wound_description text,
  procedure_description text,
  products_used jsonb not null default '[]'::jsonb,
  notes text,
  images jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_company on public.profiles(company_id);
create index if not exists idx_patients_company on public.patients(company_id);
create index if not exists idx_attendances_company_patient on public.attendances(company_id, patient_id);
create index if not exists idx_financial_company_status on public.financial_transactions(company_id, status);
create index if not exists idx_stock_company on public.stock_products(company_id);
create index if not exists idx_body_maps_company_patient on public.patient_body_maps(company_id, patient_id);

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'super_admin', false)
$$;

create or replace function public.can_access_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or public.current_company_id() = target_company_id
$$;

create or replace function public.has_financial_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('super_admin', 'company_admin', 'financial')
$$;

create or replace function public.has_clinical_write_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('super_admin', 'company_admin', 'professional')
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare
  table_name text;
begin
  foreach table_name in array array[
    'companies',
    'company_settings',
    'profiles',
    'subscriptions',
    'patients',
    'patient_clinical_data',
    'appointments',
    'attendances',
    'financial_transactions',
    'stock_products',
    'reports',
    'ai_referral_reports',
    'patient_body_maps'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name);
  end loop;
end $$;

alter table public.plans enable row level security;
alter table public.companies enable row level security;
alter table public.company_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.patients enable row level security;
alter table public.patient_clinical_data enable row level security;
alter table public.appointments enable row level security;
alter table public.attendances enable row level security;
alter table public.attendance_history enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.stock_products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.reports enable row level security;
alter table public.ai_referral_reports enable row level security;
alter table public.patient_body_maps enable row level security;

create policy "plans are readable by authenticated users"
on public.plans for select
to authenticated
using (true);

create policy "super admins manage plans"
on public.plans for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "companies are isolated by membership"
on public.companies for select
to authenticated
using (public.can_access_company(id));

create policy "super admins manage companies"
on public.companies for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "company settings are isolated"
on public.company_settings for select
to authenticated
using (public.can_access_company(company_id));

create policy "admins manage company settings"
on public.company_settings for all
to authenticated
using (public.is_super_admin() or (public.current_company_id() = company_id and public.current_role() = 'company_admin'))
with check (public.is_super_admin() or (public.current_company_id() = company_id and public.current_role() = 'company_admin'));

create policy "profiles are isolated"
on public.profiles for select
to authenticated
using (public.is_super_admin() or id = auth.uid() or public.current_company_id() = company_id);

create policy "admins manage company profiles"
on public.profiles for all
to authenticated
using (public.is_super_admin() or (public.current_company_id() = company_id and public.current_role() = 'company_admin'))
with check (public.is_super_admin() or (public.current_company_id() = company_id and public.current_role() = 'company_admin'));

create policy "subscriptions are isolated"
on public.subscriptions for select
to authenticated
using (public.can_access_company(company_id));

create policy "super admins manage subscriptions"
on public.subscriptions for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "patients are isolated"
on public.patients for select
to authenticated
using (public.can_access_company(company_id));

create policy "care team writes patients"
on public.patients for insert
to authenticated
with check (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional', 'reception'));

create policy "care team updates patients"
on public.patients for update
to authenticated
using (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional', 'reception'))
with check (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional', 'reception'));

create policy "clinical data is isolated"
on public.patient_clinical_data for select
to authenticated
using (public.can_access_company(company_id));

create policy "clinical team writes clinical data"
on public.patient_clinical_data for all
to authenticated
using (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional'))
with check (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional'));

create policy "appointments are isolated"
on public.appointments for select
to authenticated
using (public.can_access_company(company_id));

create policy "reception and care team manage appointments"
on public.appointments for all
to authenticated
using (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional', 'reception'))
with check (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional', 'reception'));

create policy "attendances are isolated"
on public.attendances for select
to authenticated
using (public.can_access_company(company_id));

create policy "professionals manage attendances"
on public.attendances for all
to authenticated
using (public.current_company_id() = company_id and public.has_clinical_write_access())
with check (public.current_company_id() = company_id and public.has_clinical_write_access());

create policy "history is isolated"
on public.attendance_history for select
to authenticated
using (public.can_access_company(company_id));

create policy "clinical team writes history"
on public.attendance_history for insert
to authenticated
with check (public.current_company_id() = company_id and public.has_clinical_write_access());

create policy "financial transactions require financial access"
on public.financial_transactions for select
to authenticated
using (public.can_access_company(company_id) and public.has_financial_access());

create policy "financial team manages transactions"
on public.financial_transactions for all
to authenticated
using (public.current_company_id() = company_id and public.has_financial_access())
with check (public.current_company_id() = company_id and public.has_financial_access());

create policy "stock products are isolated"
on public.stock_products for select
to authenticated
using (public.can_access_company(company_id));

create policy "admins and professionals manage stock"
on public.stock_products for all
to authenticated
using (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional'))
with check (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional'));

create policy "stock movements are isolated"
on public.stock_movements for select
to authenticated
using (public.can_access_company(company_id));

create policy "admins and professionals write stock movements"
on public.stock_movements for insert
to authenticated
with check (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional'));

create policy "reports are isolated"
on public.reports for select
to authenticated
using (public.can_access_company(company_id));

create policy "team manages reports"
on public.reports for all
to authenticated
using (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional', 'financial'))
with check (public.current_company_id() = company_id and public.current_role() in ('company_admin', 'professional', 'financial'));

create policy "ai referral reports are isolated"
on public.ai_referral_reports for select
to authenticated
using (public.can_access_company(company_id));

create policy "clinical team manages ai referral reports"
on public.ai_referral_reports for all
to authenticated
using (public.current_company_id() = company_id and public.has_clinical_write_access())
with check (public.current_company_id() = company_id and public.has_clinical_write_access());

create policy "body maps are isolated"
on public.patient_body_maps for select
to authenticated
using (public.can_access_company(company_id));

create policy "clinical team manages body maps"
on public.patient_body_maps for all
to authenticated
using (public.current_company_id() = company_id and public.has_clinical_write_access())
with check (public.current_company_id() = company_id and public.has_clinical_write_access());

create or replace function public.create_attendance_side_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.attendance_history (company_id, patient_id, attendance_id, event_type, description, created_by)
  values (new.company_id, new.patient_id, new.id, 'attendance_created', coalesce(new.procedure_performed, 'Atendimento registrado'), new.professional_id);

  if new.amount > 0 then
    insert into public.financial_transactions (
      company_id,
      patient_id,
      attendance_id,
      description,
      type,
      amount,
      due_date,
      payment_method,
      category,
      status,
      created_by
    )
    values (
      new.company_id,
      new.patient_id,
      new.id,
      coalesce(new.procedure_performed, 'Atendimento'),
      'income',
      new.amount,
      new.attended_at::date,
      'pix',
      'Atendimento',
      'pending',
      new.professional_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_attendance_created on public.attendances;
create trigger on_attendance_created
after insert on public.attendances
for each row execute function public.create_attendance_side_effects();

insert into public.plans (name, slug, monthly_price, limits, features)
values
  ('Start', 'start', 149, '{"users": 3, "patients": 300}'::jsonb, '["Agenda", "Pacientes", "Atendimentos"]'::jsonb),
  ('Professional', 'professional', 349, '{"users": 10, "patients": 2000}'::jsonb, '["Financeiro", "Estoque", "Relatorios IA"]'::jsonb),
  ('Enterprise', 'enterprise', 0, '{"users": -1, "patients": -1}'::jsonb, '["White label avancado", "Multiunidade", "API"]'::jsonb)
on conflict (slug) do nothing;
