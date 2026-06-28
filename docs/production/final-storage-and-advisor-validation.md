# Validacao Final de Storage, Status e Advisor - Podo360

Data: 28/06/2026

Projeto Supabase: Podo360 (`xnnt...zgtk`)

## Escopo

Rodada final dos bloqueios restantes antes de liberar producao com dados clinicos reais:

- upload real pela interface;
- isolamento de Storage com upload real;
- status `suspended` e reativacao pela interface;
- limpeza de dados ficticios;
- verificacao de PUs orfaos em `unique_medical_records`;
- reexecucao do Supabase Security Advisor;
- revisao do Leaked Password Protection.

## Upload Real / Storage

Bucket validado:

- `company-assets`

Teste executado por Playwright autenticado:

- Usuario A acessou a Clinica Pe Saudavel.
- Usuario A fez upload de `TESTE_PRODUCAO_PODO360_LOGO_A.svg` pela tela `Identidade`.
- O arquivo foi gravado em `d4666e95-0278-4cfb-b805-0b93b6bc4d4a/logo/...TESTE_PRODUCAO_PODO360_LOGO_A.svg`.
- Usuario B nao conseguiu listar o prefixo da Empresa A.
- Usuario B acessou a Clinica Teste Isolamento.
- Usuario B fez upload de `TESTE_PRODUCAO_PODO360_LOGO_B.svg` pela tela `Identidade`.
- O arquivo foi gravado em `b7cd6131-5565-406a-ac9c-eb5f0cce21f1/logo/...TESTE_PRODUCAO_PODO360_LOGO_B.svg`.
- Usuario A nao conseguiu listar o prefixo da Empresa B.
- Usuario anonimo nao conseguiu listar os prefixos das empresas.

Resultado:

- Upload real aprovado.
- Isolamento de Storage aprovado.
- Listagem anonima ampla continuou bloqueada.
- Os paths de teste foram removidos no `finally` do teste.
- Consulta final em `storage.objects` retornou 0 objetos com `TESTE_PRODUCAO_PODO360`.

## Status Suspended / Active

Empresa testada:

- Clinica Teste Isolamento
- `company_id`: `b7cd6131-5565-406a-ac9c-eb5f0cce21f1`

Procedimento:

1. Status inicial confirmado como `active`.
2. `platform_companies.status` alterado temporariamente para `suspended`, filtrado por `clinic_company_id`.
3. Login do Usuario B pela interface foi bloqueado.
4. Mensagem amigavel exibida: "O acesso da sua clinica esta temporariamente indisponivel. Entre em contato com o suporte Podo360."
5. Dashboard nao abriu.
6. Empresa B foi reativada para `active`.
7. Login do Usuario B voltou a funcionar.

Resultado:

- Bloqueio por status aprovado.
- Reativacao aprovada.
- Empresa B ficou `active` ao final.

## PUs Orfaos e Limpeza

Foram encontrados PUs orfaos de teste em `unique_medical_records`, todos com `normalized_patient_name` contendo `teste_producao_podo360` e sem referencias em:

- `patients`;
- `attendances`;
- `patient_company_links`.

Remocoes executadas:

- 29 PUs orfaos anteriores de teste.
- 7 PUs orfaos criados pela rodada final de Playwright.

Confirmacao final:

- `patients` com prefixo `TESTE_PRODUCAO_PODO360`: 0.
- `unique_medical_records` com `teste_producao_podo360`: 0.
- `storage.objects` com `TESTE_PRODUCAO_PODO360`: 0.

## Security Advisor

Supabase Security Advisor reexecutado apos upload, status e limpeza.

Avisos restantes:

- 15 warnings `authenticated_security_definer_function_executable`.
- 1 warning `auth_leaked_password_protection`.
- 29 warnings `multiple_permissive_policies`.

Classificacao:

- Nao houve alerta critico novo de RLS ou Storage.
- As 15 functions `SECURITY DEFINER` continuam aceitas temporariamente porque sao helpers/RPCs usados por RLS e fluxos clinicos. Todas as functions verificadas possuem `search_path=public`.
- `multiple_permissive_policies` e um aviso de performance/otimizacao de policies. Nao indicou vazamento no teste autenticado nem no teste de interface.
- Leaked Password Protection permanece desabilitado e deve ser habilitado manualmente no painel Supabase Auth antes do go-live final, se o plano/projeto permitir.

Functions revisadas no Advisor:

- `can_access_company`
- `cancel_attendance_finalization`
- `current_company_id`
- `current_profile`
- `current_role`
- `has_attendance_management_access`
- `has_clinical_write_access`
- `has_financial_access`
- `has_hci_enabled`
- `has_hci_view_access`
- `has_valid_hci_consent`
- `is_platform_admin`
- `is_super_admin`
- `mark_attendance_finished`
- `mark_attendance_started`

## Validacoes Tecnicas

- Lint: aprovado.
- Typecheck: aprovado.
- Build: aprovado.
- Playwright autenticado final: 12 aprovados, 1 teste de suspended pulado na rodada normal porque a Empresa B estava ativa.
- Playwright suspended controlado: aprovado com `PLAYWRIGHT_EXPECT_USER_B_SUSPENDED=true`.

Observacao:

- O build Vite emitiu apenas aviso de chunk acima de 500 kB. Nao e bloqueante de seguranca.

## Decisao

Apto para producao com dados clinicos reais, com a seguinte pendencia operacional nao bloqueante documentada:

- habilitar Leaked Password Protection no painel Supabase Auth antes do go-live final, ou registrar formalmente a impossibilidade caso o recurso nao esteja disponivel no plano/projeto.

Nao foram versionadas credenciais, `.env`, `.env.local`, `.env.test.local`, tokens ou `service_role`.
