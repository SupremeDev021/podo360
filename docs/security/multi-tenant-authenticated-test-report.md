# Teste Autenticado Multiempresa - Podo360

Data: 25/06/2026

Projeto Supabase: Podo360 (`xnnt...zgtk`)

## Objetivo

Validar se os usuarios autenticados das duas empresas iniciais enxergam apenas dados da propria clinica e se as policies RLS/Storage bloqueiam acesso cruzado antes da liberacao para dados clinicos reais.

## Empresas

Empresa A:

- Nome: Clinica Pe Saudavel
- `company_id`: `d4666e95-0278-4cfb-b805-0b93b6bc4d4a`
- Plano: Pro
- Status: `active`

Empresa B:

- Nome: Clinica Teste Isolamento
- `company_id`: `b7cd6131-5565-406a-ac9c-eb5f0cce21f1`
- Plano: Start
- Status: `active`

## Usuarios

Usuario A:

- Vinculado a Clinica Pe Saudavel.
- Role: `company_admin`.
- `active`: `true`.
- `is_platform_admin`: `false`.

Usuario B:

- Vinculado a Clinica Teste Isolamento.
- Role: `company_admin`.
- `active`: `true`.
- `is_platform_admin`: `false`.

Nenhuma senha foi registrada neste documento.

## Metodo

Os testes foram feitos diretamente no banco oficial usando sessao `authenticated` simulada por `auth.uid()`, sempre dentro de transacoes com `rollback`.

Foram criados dados temporarios de:

- paciente;
- atendimento/BA;
- anamnese;
- objetos do bucket `company-assets`.

Todos os dados temporarios foram revertidos ao final dos testes.

## Resultado - Empresa A

Com o usuario da Empresa A:

- `current_company_id()` retornou `d4666e95-0278-4cfb-b805-0b93b6bc4d4a`.
- `current_role()` retornou `company_admin`.
- `is_platform_admin()` retornou `false`.
- Viu 1 paciente temporario proprio.
- Viu 1 atendimento temporario proprio.
- Viu 1 anamnese temporaria propria.
- Nao viu paciente temporario da Empresa B.
- Nao viu atendimento temporario da Empresa B.
- Nao viu anamnese temporaria da Empresa B.
- Nao visualizou `platform_leads`.
- Nao visualizou `platform_admin_audit_logs`.
- Viu apenas asset temporario no caminho do proprio `company_id`.
- Nao viu asset temporario da Empresa B.

## Resultado - Empresa B

Com o usuario da Empresa B:

- `current_company_id()` retornou `b7cd6131-5565-406a-ac9c-eb5f0cce21f1`.
- `current_role()` retornou `company_admin`.
- `is_platform_admin()` retornou `false`.
- Viu 1 paciente temporario proprio.
- Viu 1 atendimento temporario proprio.
- Viu 1 anamnese temporaria propria.
- Nao viu paciente temporario da Empresa A.
- Nao viu atendimento temporario da Empresa A.
- Nao viu anamnese temporaria da Empresa A.
- Nao visualizou `platform_leads`.
- Nao visualizou `platform_admin_audit_logs`.
- Viu apenas asset temporario no caminho do proprio `company_id`.
- Nao viu asset temporario da Empresa A.

## Status Suspended

Foi testado em transacao com `rollback`:

- Empresa B em `active` retornou `active` na view `company_platform_access`.
- Empresa B temporariamente alterada para `suspended` retornou `suspended`.
- Apos rollback, Empresa B permaneceu `active`.

## Security Advisor

Advisor executado apos os testes autenticados.

Warnings restantes:

- functions `SECURITY DEFINER` executaveis por `authenticated`;
- Leaked Password Protection desabilitado no Supabase Auth.

Classificacao:

- Functions mantidas temporariamente porque sao helpers/RPCs usados por RLS e fluxos clinicos.
- Leaked Password Protection deve ser habilitado/revisado no painel Supabase antes da producao real.

Nao apareceu alerta critico novo de RLS/storage nos testes executados.

## Conclusao

O isolamento RLS e Storage passou nos testes autenticados por banco com rollback.

Ainda nao liberar dados clinicos reais ate validar:

- login real no navegador;
- abertura de atendimento pela interface;
- anamnese completa pela interface;
- relatorios/PDF pela interface;
- upload real de asset/logo pela interface;
- Security Advisor apos fluxo clinico completo pela interface.

Atualizacao em 26/06/2026:

- A interface local respondeu `HTTP 200`.
- Lint, typecheck e build passaram.
- O login real no navegador nao foi executado nesta etapa porque `.env.local` nao existe neste workspace e as senhas nao devem ser registradas em logs/documentos.
- A proxima validacao obrigatoria esta detalhada em `docs/security/interface-production-validation-report.md`.
