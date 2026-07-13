# Limite de usuarios por clinica

## Objetivo

O Admin Global Podo360 pode definir quantos usuarios ativos cada clinica pode manter. Esse limite e usado pelo Sistema Clinica antes de convidar ou reativar usuarios.

## Campo

O limite fica em:

```text
public.platform_company_subscriptions.max_users
```

Regras:

- `null`: usuarios ilimitados, conforme permissao.
- `0`: bloqueia criacao/reativacao de usuarios ativos.
- numero maior que `0`: limite maximo de usuarios ativos da clinica.

Quando o limite da assinatura nao estiver definido, a plataforma usa o padrao do plano:

```text
public.platform_plans.max_users
```

## View de acesso

A view `public.company_platform_access` passa a expor:

```text
max_users
```

Esse valor e usado pelo Sistema Clinica para mostrar:

```text
Usuarios ativos: atual / limite
```

## Bloqueio seguro

A validacao forte acontece na Edge Function:

```text
supabase/functions/admin-create-company-user
```

Ela bloqueia:

- convite de novo usuario quando o limite foi atingido;
- reativacao de usuario inativo quando a reativacao ultrapassaria o limite;
- criacao fora do `company_id` permitido para o admin da clinica.

Mensagem exibida:

```text
Limite de usuarios atingido para sua clinica. Entre em contato com o suporte Podo360 para aumentar o limite.
```

## Admin Global

O Admin Global separado permite editar o limite na tela de Empresas. A alteracao registra auditoria em:

```text
public.platform_admin_audit_logs
```

## Producao

A migration deve ser aplicada no Supabase oficial antes de usar o campo em producao:

```text
20260712000100_add_company_user_limits.sql
```

Nao aplicar migration em ambiente errado. Nao usar SQL destrutivo.
