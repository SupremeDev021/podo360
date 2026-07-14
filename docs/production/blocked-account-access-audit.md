# Auditoria de Conta Bloqueada - Podo360 Clinica

Data: 14/07/2026

## Conta analisada

- E-mail: `monteirotec.ofc@gmail.com`
- Clinica esperada: Clinica Pe Saudavel
- `company_id`: `d4666e95-0278-4cfb-b805-0b93b6bc4d4a`

## Causa encontrada

A conta nao estava bloqueada por senha, convite, email nao confirmado, profile ausente ou RLS.

Estado encontrado antes da correcao:

- Usuario existia em Auth.
- E-mail estava confirmado.
- `profiles.id` batia com `auth.users.id`.
- `profiles.active = true`.
- Role: `company_admin`.
- `company_id` correto.
- `companies.plan_status = active`.
- Assinatura comercial: `active`.
- `platform_companies.status = suspended`.
- `company_platform_access.status = suspended`.

Portanto, o bloqueio era legitimo pelo mecanismo de status comercial da clinica. A Clinica Pe Saudavel estava suspensa no Admin Global.

## Correcao aplicada

Foi reativado somente o registro comercial da Clinica Pe Saudavel em `platform_companies`, com filtro por:

- `platform_company_id = c0d7e1c7-84bc-4a1a-a8d2-e90650608616`
- `clinic_company_id = d4666e95-0278-4cfb-b805-0b93b6bc4d4a`
- status anterior `suspended`

Tambem foi registrado log em `platform_company_status_logs`:

- `previous_status = suspended`
- `new_status = active`
- motivo: reativacao operacional apos diagnostico de usuario clinico bloqueado.

## Estado apos correcao

- `platform_companies.status = active`.
- `company_platform_access.status = active`.
- Login real da conta foi validado via Supabase Auth.
- Profile foi carregado.
- Empresa carregada: Clinica Pe Saudavel.
- Role carregada: `company_admin`.

## Auditoria de risco para outras contas

Auditoria executada:

- Auth users sem profile: 0.
- Profiles sem auth user: 0.
- Profiles com `company_id` ausente: 1.
- Profiles com `company_id` inexistente: 0.
- Profiles ativos de clinica com acesso bloqueado: 0 apos correcao.
- Auth users sem e-mail confirmado: 0.

O unico profile com `company_id` ausente e o owner do Admin Global (`platform_admin_users.role = owner`), situacao esperada e nao corrigida.

## Decisao

Conta corrigida e risco auditado.
