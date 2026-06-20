# Schema Futuro da Plataforma Podo360

## Objetivo

Este documento descreve a estrutura futura para gestão global da plataforma Podo360. Nenhuma migration real deve ser aplicada nesta etapa.

Recomendação: usar um schema dedicado, como `platform`, ou prefixar tabelas com `platform_`, sempre com RLS, policies específicas e funções seguras quando necessário.

## `platform_companies`

Empresas contratantes da Podo360.

Campos sugeridos:

- `id`
- `company_name`
- `trading_name`
- `cnpj`
- `responsible_name`
- `responsible_email`
- `responsible_phone`
- `status`
- `plan_id`
- `created_at`
- `updated_at`
- `activated_at`
- `deactivated_at`
- `suspended_at`

Status previstos:

- `active`
- `trial`
- `inactive`
- `suspended`
- `cancelled`

## `platform_leads`

Leads captados pela Landing Page.

Campos sugeridos:

- `id`
- `name`
- `clinic_name`
- `email`
- `phone`
- `city`
- `source`
- `message`
- `status`
- `created_at`
- `updated_at`

Observação: a Landing Page deve apenas inserir leads por API/Edge Function segura. Ela não deve listar leads.

## `platform_company_status_logs`

Histórico de alterações de status das empresas.

Campos sugeridos:

- `id`
- `company_id`
- `previous_status`
- `new_status`
- `reason`
- `changed_by`
- `created_at`

## `platform_admin_users`

Usuários internos da Podo360 autorizados a acessar o `podo360-admin`.

Campos sugeridos:

- `id`
- `user_id`
- `role`
- `active`
- `created_at`
- `updated_at`

Papéis futuros possíveis:

- `platform_owner`
- `platform_admin`
- `commercial`
- `support`
- `viewer`

## `platform_plans`

Planos comerciais futuros. Não definir preços finais nesta fase.

Campos sugeridos:

- `id`
- `name`
- `description`
- `features`
- `active`
- `created_at`
- `updated_at`

## `platform_company_subscriptions`

Vínculo futuro entre empresa e plano.

Campos sugeridos:

- `id`
- `company_id`
- `plan_id`
- `status`
- `trial_ends_at`
- `starts_at`
- `renews_at`
- `cancelled_at`
- `notes`
- `created_at`
- `updated_at`

## Feature Flags Futuras

Tabelas possíveis:

`feature_flags`:

- `id`
- `key`
- `name`
- `description`
- `active`
- `created_at`

`company_feature_flags`:

- `id`
- `company_id`
- `feature_key`
- `enabled`
- `source`
- `created_at`
- `updated_at`

Features previstas:

- `dashboard`
- `atendimentos`
- `agenda`
- `financeiro`
- `estoque`
- `pe_3d`
- `relatorios`
- `white_label`
- `ia_relatorio`
- `gerenciamento_atendimento`
- `autoclave`

## Segurança

- Não usar `service_role` no frontend.
- Não expor tabelas globais para clínicas.
- Não permitir que o Sistema Clínica consulte leads.
- Não permitir que uma clínica veja empresas de outras clínicas.
- Não usar `user_metadata` como fonte confiável de permissão.
- Usar RLS forte e policies por papel administrativo.
- Preferir Edge Functions ou RPCs seguras para operações privilegiadas.

## Fora do Escopo

Nesta fase, não aplicar migrations, não criar cobrança, não definir preços e não bloquear módulos por plano.
