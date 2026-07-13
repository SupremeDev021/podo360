alter table public.platform_company_subscriptions
  add column if not exists max_users integer;

alter table public.platform_company_subscriptions
  drop constraint if exists platform_company_subscriptions_max_users_check;

alter table public.platform_company_subscriptions
  add constraint platform_company_subscriptions_max_users_check
  check (max_users is null or max_users >= 0);

create index if not exists idx_platform_subscriptions_max_users
on public.platform_company_subscriptions(company_id, status, max_users);

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
  coalesce(subscription.max_users, plan.max_users) as max_users,
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
left join lateral (
  select active_subscription.max_users
  from public.platform_company_subscriptions active_subscription
  where active_subscription.company_id = company.id
    and active_subscription.status in ('active', 'trial')
  order by active_subscription.created_at desc
  limit 1
) subscription on true
where company.clinic_company_id is not null;
