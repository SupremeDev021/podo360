create table if not exists public.platform_admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'support', 'commercial')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admin_users admin_user
    where admin_user.user_id = auth.uid()
      and admin_user.active = true
  );
$$;

create table if not exists public.platform_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  monthly_price numeric(12,2),
  setup_fee numeric(12,2),
  is_custom_price boolean not null default false,
  max_users integer,
  max_professionals integer,
  max_patients integer,
  max_storage_mb integer,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_plan_extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price numeric(12,2),
  min_price numeric(12,2),
  max_price numeric(12,2),
  is_range_price boolean not null default false,
  billing_type text not null check (billing_type in ('monthly', 'one_time', 'project')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_companies (
  id uuid primary key default gen_random_uuid(),
  clinic_company_id uuid unique references public.companies(id) on delete set null,
  company_name text not null,
  trading_name text,
  cnpj text,
  responsible_name text,
  responsible_email text,
  responsible_phone text,
  status text not null default 'trial' check (status in ('active', 'trial', 'inactive', 'suspended', 'cancelled')),
  plan_id uuid references public.platform_plans(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  suspended_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists public.platform_company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.platform_companies(id) on delete cascade,
  plan_id uuid references public.platform_plans(id) on delete set null,
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  monthly_price numeric(12,2),
  setup_fee numeric(12,2),
  starts_at date,
  trial_ends_at date,
  renews_at date,
  cancelled_at timestamptz,
  contract_min_months integer not null default 3,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_company_subscription_extras (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.platform_company_subscriptions(id) on delete cascade,
  extra_id uuid not null references public.platform_plan_extras(id) on delete restrict,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subscription_id, extra_id)
);

create table if not exists public.platform_features (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.platform_plans(id) on delete cascade,
  feature_key text not null references public.platform_features(key) on delete cascade,
  enabled boolean not null default true,
  limit_value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, feature_key)
);

create table if not exists public.platform_company_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.platform_companies(id) on delete cascade,
  feature_key text not null references public.platform_features(key) on delete cascade,
  enabled boolean not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, feature_key)
);

create table if not exists public.platform_company_status_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.platform_companies(id) on delete cascade,
  previous_status text,
  new_status text not null,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  company_id uuid references public.platform_companies(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  clinic_name text,
  email text,
  phone text,
  city text,
  source text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'converted', 'lost', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'maintenance', 'critical')),
  active boolean not null default false,
  dismissible boolean not null default false,
  target_scope text not null default 'all' check (target_scope in ('all', 'specific_companies')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_announcement_companies (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.platform_announcements(id) on delete cascade,
  company_id uuid not null references public.platform_companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(announcement_id, company_id)
);

create index if not exists idx_platform_companies_clinic_company on public.platform_companies(clinic_company_id);
create index if not exists idx_platform_companies_status on public.platform_companies(status);
create index if not exists idx_platform_subscriptions_company on public.platform_company_subscriptions(company_id, status);
create index if not exists idx_platform_plan_features_plan on public.platform_plan_features(plan_id, feature_key);
create index if not exists idx_platform_feature_overrides_company on public.platform_company_feature_overrides(company_id, feature_key);
create index if not exists idx_platform_status_logs_company on public.platform_company_status_logs(company_id, created_at desc);
create index if not exists idx_platform_announcements_active_period on public.platform_announcements(active, starts_at, ends_at);

alter table public.platform_admin_users enable row level security;
alter table public.platform_plans enable row level security;
alter table public.platform_plan_extras enable row level security;
alter table public.platform_companies enable row level security;
alter table public.platform_company_subscriptions enable row level security;
alter table public.platform_company_subscription_extras enable row level security;
alter table public.platform_features enable row level security;
alter table public.platform_plan_features enable row level security;
alter table public.platform_company_feature_overrides enable row level security;
alter table public.platform_company_status_logs enable row level security;
alter table public.platform_admin_audit_logs enable row level security;
alter table public.platform_leads enable row level security;
alter table public.platform_announcements enable row level security;
alter table public.platform_announcement_companies enable row level security;

drop policy if exists "platform admins read admin users" on public.platform_admin_users;
create policy "platform admins read admin users"
on public.platform_admin_users for select to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists "platform admins manage admin users" on public.platform_admin_users;
create policy "platform admins manage admin users"
on public.platform_admin_users for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "authenticated reads active platform plans" on public.platform_plans;
create policy "authenticated reads active platform plans"
on public.platform_plans for select to authenticated
using (active = true or public.is_platform_admin());

drop policy if exists "platform admins manage platform plans" on public.platform_plans;
create policy "platform admins manage platform plans"
on public.platform_plans for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "authenticated reads active platform extras" on public.platform_plan_extras;
create policy "authenticated reads active platform extras"
on public.platform_plan_extras for select to authenticated
using (active = true or public.is_platform_admin());

drop policy if exists "platform admins manage platform extras" on public.platform_plan_extras;
create policy "platform admins manage platform extras"
on public.platform_plan_extras for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform companies are admin or own clinic scoped" on public.platform_companies;
create policy "platform companies are admin or own clinic scoped"
on public.platform_companies for select to authenticated
using (public.is_platform_admin() or clinic_company_id = public.current_company_id());

drop policy if exists "platform admins manage platform companies" on public.platform_companies;
create policy "platform admins manage platform companies"
on public.platform_companies for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform subscriptions are admin or own clinic scoped" on public.platform_company_subscriptions;
create policy "platform subscriptions are admin or own clinic scoped"
on public.platform_company_subscriptions for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.platform_companies company
    where company.id = platform_company_subscriptions.company_id
      and company.clinic_company_id = public.current_company_id()
  )
);

drop policy if exists "platform admins manage platform subscriptions" on public.platform_company_subscriptions;
create policy "platform admins manage platform subscriptions"
on public.platform_company_subscriptions for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform subscription extras are admin or own clinic scoped" on public.platform_company_subscription_extras;
create policy "platform subscription extras are admin or own clinic scoped"
on public.platform_company_subscription_extras for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.platform_company_subscriptions subscription
    join public.platform_companies company on company.id = subscription.company_id
    where subscription.id = platform_company_subscription_extras.subscription_id
      and company.clinic_company_id = public.current_company_id()
  )
);

drop policy if exists "platform admins manage platform subscription extras" on public.platform_company_subscription_extras;
create policy "platform admins manage platform subscription extras"
on public.platform_company_subscription_extras for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "authenticated reads active platform features" on public.platform_features;
create policy "authenticated reads active platform features"
on public.platform_features for select to authenticated
using (active = true or public.is_platform_admin());

drop policy if exists "platform admins manage platform features" on public.platform_features;
create policy "platform admins manage platform features"
on public.platform_features for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "authenticated reads active platform plan features" on public.platform_plan_features;
create policy "authenticated reads active platform plan features"
on public.platform_plan_features for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.platform_plans plan
    where plan.id = platform_plan_features.plan_id
      and plan.active = true
  )
);

drop policy if exists "platform admins manage platform plan features" on public.platform_plan_features;
create policy "platform admins manage platform plan features"
on public.platform_plan_features for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform feature overrides are admin or own clinic scoped" on public.platform_company_feature_overrides;
create policy "platform feature overrides are admin or own clinic scoped"
on public.platform_company_feature_overrides for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.platform_companies company
    where company.id = platform_company_feature_overrides.company_id
      and company.clinic_company_id = public.current_company_id()
  )
);

drop policy if exists "platform admins manage platform feature overrides" on public.platform_company_feature_overrides;
create policy "platform admins manage platform feature overrides"
on public.platform_company_feature_overrides for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform status logs are admin or own clinic scoped" on public.platform_company_status_logs;
create policy "platform status logs are admin or own clinic scoped"
on public.platform_company_status_logs for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.platform_companies company
    where company.id = platform_company_status_logs.company_id
      and company.clinic_company_id = public.current_company_id()
  )
);

drop policy if exists "platform admins manage status logs" on public.platform_company_status_logs;
create policy "platform admins manage status logs"
on public.platform_company_status_logs for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform admins manage audit logs" on public.platform_admin_audit_logs;
create policy "platform admins manage audit logs"
on public.platform_admin_audit_logs for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform admins manage leads" on public.platform_leads;
create policy "platform admins manage leads"
on public.platform_leads for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform announcements visible to target clinics" on public.platform_announcements;
create policy "platform announcements visible to target clinics"
on public.platform_announcements for select to authenticated
using (
  public.is_platform_admin()
  or (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and (
      target_scope = 'all'
      or exists (
        select 1
        from public.platform_announcement_companies target
        join public.platform_companies company on company.id = target.company_id
        where target.announcement_id = platform_announcements.id
          and company.clinic_company_id = public.current_company_id()
      )
    )
  )
);

drop policy if exists "platform admins manage announcements" on public.platform_announcements;
create policy "platform admins manage announcements"
on public.platform_announcements for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform announcement targets visible to target clinics" on public.platform_announcement_companies;
create policy "platform announcement targets visible to target clinics"
on public.platform_announcement_companies for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.platform_companies company
    where company.id = platform_announcement_companies.company_id
      and company.clinic_company_id = public.current_company_id()
  )
);

drop policy if exists "platform admins manage announcement targets" on public.platform_announcement_companies;
create policy "platform admins manage announcement targets"
on public.platform_announcement_companies for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace view public.company_platform_access
with (security_invoker = true)
as
select
  company.clinic_company_id as company_id,
  company.status,
  plan.id as plan_id,
  plan.name as plan_name,
  plan.slug as plan_slug,
  plan.is_custom_price,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'key', feature.key,
        'enabled', coalesce(override.enabled, plan_feature.enabled, true),
        'limit_value', plan_feature.limit_value,
        'source', case when override.id is not null then 'company_override' else 'plan' end
      )
      order by feature.key
    )
    from public.platform_features feature
    left join public.platform_plan_features plan_feature
      on plan_feature.feature_key = feature.key
      and plan_feature.plan_id = company.plan_id
    left join public.platform_company_feature_overrides override
      on override.feature_key = feature.key
      and override.company_id = company.id
    where feature.active = true
      and (plan_feature.id is not null or override.id is not null)
  ), '[]'::jsonb) as features
from public.platform_companies company
left join public.platform_plans plan on plan.id = company.plan_id
where company.clinic_company_id is not null;

insert into public.platform_plans (name, slug, description, monthly_price, setup_fee, is_custom_price, display_order)
values
  ('Start', 'start', 'Indicado para podólogo individual ou clínica pequena.', 197, 497, false, 10),
  ('Clinic', 'clinic', 'Indicado para clínica pequena ou em crescimento.', 397, 997, false, 20),
  ('Pro', 'pro', 'Indicado para clínicas com equipe e gestão completa.', 697, 1497, false, 30),
  ('Master', 'master', 'Indicado para clínicas premium, rede ou white label avançado. Valores a partir de.', 997, 2497, true, 40)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  setup_fee = excluded.setup_fee,
  is_custom_price = excluded.is_custom_price,
  display_order = excluded.display_order,
  updated_at = now();

insert into public.platform_plan_extras (name, slug, description, price, min_price, max_price, is_range_price, billing_type)
values
  ('Usuário adicional', 'usuario-adicional', 'Usuário adicional para equipe da clínica.', 39, null, null, false, 'monthly'),
  ('Profissional adicional', 'profissional-adicional', 'Profissional adicional para operação clínica.', 59, null, null, false, 'monthly'),
  ('Treinamento extra', 'treinamento-extra', 'Treinamento extra para equipe.', 250, null, null, false, 'one_time'),
  ('Personalização de relatório/PDF', 'personalizacao-relatorio-pdf', 'Personalização visual e estrutural de relatório ou PDF.', null, 300, 800, true, 'project'),
  ('Implantação avançada', 'implantacao-avancada', 'Implantação assistida para operação avançada.', null, 1500, 3000, true, 'project'),
  ('White label personalizado fora do Master', 'white-label-personalizado', 'Personalização white label fora do plano Master.', null, 700, 1500, true, 'project')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  min_price = excluded.min_price,
  max_price = excluded.max_price,
  is_range_price = excluded.is_range_price,
  billing_type = excluded.billing_type,
  updated_at = now();

insert into public.platform_features (key, name, description)
values
  ('dashboard', 'Dashboard', 'Painel operacional da clínica.'),
  ('abertura_atendimento', 'Abertura de atendimento', 'Abertura de BA/atendimento.'),
  ('atendimentos', 'Atendimentos', 'Gestão de atendimentos clínicos.'),
  ('pacientes', 'Pacientes', 'Cadastro e pesquisa de pacientes.'),
  ('agenda_clinica', 'Agenda Clínica', 'Agenda e fluxo de chegada.'),
  ('prontuario_evolucao', 'Prontuário de Evolução', 'Histórico e evolução clínica.'),
  ('anamnese_completa', 'Anamnese completa', 'Ficha modular de anamnese.'),
  ('avaliacao_sensibilidade', 'Avaliação de Sensibilidade', 'Sensibilidade e monofilamento.'),
  ('pe_3d', 'Pé 3D', 'Seleção visual do pé.'),
  ('itb_ihb', 'ITB/IHB', 'Índices vasculares.'),
  ('glicemia_eva', 'Glicemia e EVA', 'Campos de glicemia e dor.'),
  ('diagnostico_ungueal', 'Diagnóstico Ungueal', 'Avaliação ungueal por pé.'),
  ('curativo', 'Curativo', 'Curativos e produtos utilizados.'),
  ('evolucao_imagem', 'Evolução por Imagem', 'Registro de imagens clínicas.'),
  ('comparativo_evolucao', 'Comparativo de evolução', 'Comparação de evolução do tratamento.'),
  ('financeiro', 'Financeiro', 'Financeiro da clínica.'),
  ('estoque', 'Estoque', 'Estoque e produtos.'),
  ('relatorios', 'Relatórios', 'Relatórios clínicos e operacionais.'),
  ('white_label', 'White Label', 'Personalização visual da clínica.'),
  ('gerenciamento_atendimento', 'Gerenciamento de Atendimento', 'Reabertura e auditoria de atendimentos.'),
  ('avisos_globais', 'Avisos Globais', 'Exibição de avisos da plataforma.'),
  ('suporte_prioritario', 'Suporte Prioritário', 'Prioridade de suporte.'),
  ('relatorio_ia', 'Relatório com IA', 'Geração assistida por IA.')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();
