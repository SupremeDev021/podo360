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

Atualizacao de autenticacao em 26/06/2026:

- Foi encontrado acesso indevido sem login real na interface, causado por fluxo demo/estado local.
- O app foi corrigido para renderizar telas clinicas apenas com sessao Supabase real, `profile` valido e empresa ativa.
- O teste E2E `bloqueia acesso interno sem sessao real` passou.
- Os testes multiempresa pela interface continuam pendentes porque dependem das credenciais reais dos Usuarios A e B configuradas fora do Git.

Decisao:

- O isolamento multiempresa de banco continua aprovado por simulacao autenticada com rollback.
- O isolamento visual multiempresa ainda precisa ser repetido pela interface antes de liberar dados clinicos reais.

Atualizacao de Administracao da Clinica - 28/06/2026:

- A tela "Administracao da Clinica" foi liberada para `company_admin`.
- A criacao de funcionarios foi limitada a perfis clinicos.
- `company_admin` nao consegue criar usuario com role `super_admin`.
- `company_admin` nao consegue atualizar usuario de outra empresa pela Edge Function `admin-create-company-user`.
- A validacao foi feita com Usuario A e sessao real, sem persistir funcionario de teste.

Decisao adicional:

- O isolamento de gerenciamento de funcionarios por empresa foi reforcado.
- Ainda falta repetir o isolamento visual completo pela interface com criacao controlada de paciente/BA/anamnese para Empresa A e Empresa B antes de liberar dados clinicos reais.

Atualizacao final - 28/06/2026:

- Playwright autenticado final executado com Usuario A e Usuario B.
- Login real, bloqueio sem sessao, logout, BA, anamnese critica, finalizacao/reabertura, relatorio com IA e administracao da clinica foram aprovados.
- Upload real de logo/asset pela interface foi aprovado para as duas empresas no bucket `company-assets`.
- Usuario A nao conseguiu listar assets da Empresa B.
- Usuario B nao conseguiu listar assets da Empresa A.
- Usuario anonimo nao conseguiu listar os prefixos das empresas.
- Status `suspended` da Empresa B bloqueou login pela interface.
- Reativacao para `active` liberou login novamente.
- Dados ficticios criados por Playwright foram removidos por prefixo.
- PUs orfaos de teste em `unique_medical_records` foram removidos.

Decisao final:

- Isolamento multiempresa autenticado e isolamento de Storage aprovados para a rodada final.
- Apto para producao com dados clinicos reais, mantendo como pendencia operacional a habilitacao do Leaked Password Protection no painel Supabase Auth.
