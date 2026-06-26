# Relatorio de Hardening do Supabase Producao Podo360

Data da validacao: 25/06/2026

Projeto validado: Podo360 (`xnnt...zgtk`)

## Escopo

Esta validacao revisou a base oficial do Supabase Podo360 apos a aplicacao das migrations do sistema clinico e da estrutura de plataforma/admin.

O objetivo foi validar empresa inicial, estrutura multiempresa, RLS, functions, Storage e avisos do Security Advisor antes de liberar uso real com dados clinicos.

## Empresa Inicial

Empresa criada/validada:

- Nome: Clinica Pe Saudavel
- Status clinico: `active`
- Plano comercial: Pro
- Registro em `companies`: criado
- Registro em `company_settings`: criado
- Registro em `platform_companies`: criado
- Registro em `platform_company_subscriptions`: criado

Nenhum dado sensivel real foi inserido nesta etapa.

## Segunda Empresa de Isolamento

Empresa criada/validada para teste multiempresa:

- Nome: Clinica Teste Isolamento
- Status clinico: `active`
- Plano comercial: Start
- Registro em `companies`: criado
- Registro em `company_settings`: criado
- Registro em `platform_companies`: criado
- Registro em `platform_company_subscriptions`: criado

Esta empresa foi criada apenas para validar isolamento entre clinicas antes da entrada de dados clinicos reais.

## Usuario Inicial

Foram criados dois usuarios em `auth.users` pelo fluxo seguro, sem migration versionada com senha.

Usuario A:

- Empresa: Clinica Pe Saudavel
- `company_id`: `d4666e95-0278-4cfb-b805-0b93b6bc4d4a`
- Role: `company_admin`
- `active`: `true`
- `is_platform_admin`: `false`

Usuario B:

- Empresa: Clinica Teste Isolamento
- `company_id`: `b7cd6131-5565-406a-ac9c-eb5f0cce21f1`
- Role: `company_admin`
- `active`: `true`
- `is_platform_admin`: `false`

Validado no banco:

- `auth.uid()` reconhece os dois usuarios quando a sessao autenticada e simulada via JWT claim.
- `current_company_id()` retorna o `company_id` correto para cada usuario.
- `current_role()` retorna `company_admin`.
- `is_platform_admin()` retorna `false` para ambos.

Senhas nao foram registradas, versionadas ou documentadas.

## Fluxo de Setup Inicial

Foi preparado um fluxo seguro para auxiliar a criacao do primeiro usuario:

- rota do Admin: `/admin/setup`;
- documento operacional: `docs/setup/criar-primeiro-usuario-podo360.md`;
- script exemplo sem segredo: `scripts/setup/create-initial-user.example.ts`.

Esse fluxo nao coloca senha em migration e nao usa `service_role` no frontend. A criacao real do usuario deve acontecer pelo Supabase Auth ou por script local ignorado pelo Git.

## Validacao de Banco

Migrations remotas sincronizadas:

- `001` a `016`
- `20260625220315_production_security_hardening`
- `20260625220815_restrict_internal_function_execute`

Foi executado teste transacional com rollback para validar triggers de atendimento:

- criacao temporaria de paciente;
- criacao temporaria de atendimento;
- geracao de `ba_number`;
- geracao de `unique_record_number`;
- rollback ao final.

Resultado: triggers executaram corretamente e nenhum paciente, atendimento ou PU de teste ficou persistido.

## RLS

Todas as tabelas do schema `public` revisadas apareceram com RLS habilitado.

Tabelas clinicas revisadas incluem:

- `companies`
- `profiles`
- `patients`
- `patient_company_links`
- `unique_medical_records`
- `attendances`
- `anamnesis_records`
- `foot_sensitivity_maps`
- `attendance_images`
- `attendance_audit_logs`
- `appointments`
- `financial_transactions`
- `stock_products`
- `stock_movements`
- `reports`
- `company_settings`
- `autoclave_records`

Tabelas de plataforma/admin revisadas incluem:

- `platform_companies`
- `platform_leads`
- `platform_plans`
- `platform_plan_extras`
- `platform_company_subscriptions`
- `platform_features`
- `platform_plan_features`
- `platform_company_feature_overrides`
- `platform_announcements`
- `platform_company_status_logs`
- `platform_admin_audit_logs`
- `platform_admin_users`

Observacao: `system_year_counters` e `company_year_counters` possuem RLS habilitado e sem policies de usuario direto, pois sao tabelas internas de contador usadas por functions/triggers.

## Functions e RPC

Correcoes aplicadas:

- `touch_updated_at` recebeu `search_path = public`.
- `normalize_patient_name` recebeu `search_path = public, extensions`.
- `hash_patient_lookup` recebeu `search_path = public, extensions`.
- Extensao `unaccent` foi movida para o schema `extensions`.
- Execucao de functions no schema `public` foi revogada de `PUBLIC` e `anon`.
- Execucao foi concedida novamente apenas para functions necessarias ao app/RLS para `authenticated`.
- Execucao direta por `authenticated` foi revogada de functions internas de trigger/contador.

Functions internas restringidas:

- `assert_attendance_is_editable`
- `assign_attendance_ba_number`
- `assign_unique_medical_record`
- `create_attendance_side_effects`
- `find_unique_medical_record`
- `next_company_counter`
- `next_system_counter`
- `prevent_finalized_attendance_write`
- `rls_auto_enable`
- `sync_patient_company_link`

Functions ainda executaveis por `authenticated` de forma intencional:

- helpers usados em RLS, como `current_company_id`, `current_role`, `can_access_company`;
- checks de permissao, como `has_clinical_write_access`, `has_financial_access`, `has_attendance_management_access`;
- RPCs usados pelo app para fluxo de atendimento, como `mark_attendance_started`, `mark_attendance_finished`, `cancel_attendance_finalization`.

Esses avisos restantes do Security Advisor devem ser reavaliados depois do primeiro login real para confirmar se algum RPC pode ser migrado para uma Edge Function ou schema privado.

## Storage

Bucket revisado:

- `company-assets`

Configuracao:

- Publico: sim
- Uso previsto: logos e assets visuais da clinica/white label
- Tamanho maximo: 5 MB
- MIME types permitidos: imagens comuns e SVG

Correcoes aplicadas:

- removida policy ampla `company logos are publicly readable`, que permitia listagem publica do bucket;
- criada policy `clinic admins read own company assets` para leitura autenticada escopada por pasta `company_id`;
- policies de upload/update/delete continuam restritas ao `company_id` e aos roles administrativos da clinica.

Observacao: URLs publicas de objetos continuam adequadas para logos/white label, mas a listagem anonima ampla foi fechada.

## Security Advisor

Avisos corrigidos:

- `function_search_path_mutable`
- `extension_in_public` para `unaccent`
- `public_bucket_allows_listing`
- functions `SECURITY DEFINER` executaveis por `anon`
- functions internas executaveis diretamente por `authenticated`

Avisos restantes:

- algumas functions `SECURITY DEFINER` continuam executaveis por `authenticated`.

Motivo:

Essas functions sao usadas por RLS ou por RPCs reais do app. Revogar sem teste com usuario real poderia quebrar login, BA, finalizacao, reabertura e leitura multiempresa.

Avisos restantes observados apos hardening e criacao da segunda empresa:

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

Classificacao atual:

- Aceitos temporariamente com justificativa tecnica.
- Precisam ser reavaliados depois de login real e execucao dos fluxos clinicos.
- Nao foram classificados como liberacao final para dados clinicos reais.

## Teste Multiempresa

Foi executado teste multiempresa autenticado por RLS com transacao e `rollback`.

Metodo:

- Criado paciente temporario da Empresa A.
- Criado atendimento temporario da Empresa A.
- Criada anamnese temporaria da Empresa A.
- Criado paciente temporario da Empresa B.
- Criado atendimento temporario da Empresa B.
- Criada anamnese temporaria da Empresa B.
- Simulada sessao `authenticated` com `auth.uid()` do Usuario A.
- Simulada sessao `authenticated` com `auth.uid()` do Usuario B.
- Executado `rollback` ao final de cada teste.

Resultado Empresa A:

- Viu seu proprio paciente, atendimento e anamnese.
- Nao viu paciente, atendimento ou anamnese da Empresa B.
- Nao visualizou `platform_leads`.
- Nao visualizou `platform_admin_audit_logs`.

Resultado Empresa B:

- Viu seu proprio paciente, atendimento e anamnese.
- Nao viu paciente, atendimento ou anamnese da Empresa A.
- Nao visualizou `platform_leads`.
- Nao visualizou `platform_admin_audit_logs`.

Conclusao: o isolamento RLS basico entre empresas passou no banco. Ainda falta validar os mesmos fluxos pela interface com login real no navegador.

## Validacao do App

Login real visual ainda precisa ser validado no navegador usando as senhas criadas fora do repositorio.

Validado nesta etapa:

- conexao CLI com projeto Podo360;
- migrations remotas;
- empresa inicial;
- settings da empresa;
- assinatura comercial inicial;
- RLS habilitado;
- functions principais;
- Storage;
- triggers de BA/PU em transacao com rollback.
- segunda empresa de isolamento criada e vinculada a plano/status.
- usuarios Auth e profiles vinculados a `company_id`;
- helpers `current_company_id`, `current_role` e `is_platform_admin`;
- isolamento multiempresa por RLS com usuarios autenticados simulados;
- Storage `company-assets` com leitura escopada por pasta `company_id`;
- view `company_platform_access` refletindo `active` e `suspended` em transacao com rollback.

## Credenciais

Nenhuma credencial foi versionada.

Nao foram commitados:

- `.env`
- `.env.local`
- chave secreta
- `service_role`
- senha
- token Supabase
- dumps com dados sensiveis

## Storage - Teste Autenticado

Teste executado no bucket `company-assets`:

- Objeto temporario da Empresa A no caminho do `company_id` da Empresa A.
- Objeto temporario da Empresa B no caminho do `company_id` da Empresa B.
- Usuario A viu apenas o asset da propria empresa.
- Usuario A nao viu o asset da Empresa B.
- Usuario B viu apenas o asset da propria empresa.
- Usuario B nao viu o asset da Empresa A.
- Objetos temporarios revertidos com `rollback`.

Como o bucket e publico para servir logos/assets visuais, URLs publicas de objetos continuam possiveis, mas a listagem ampla anonima permanece fechada.

## Status da Empresa

Validado via view `company_platform_access`:

- Empresa B em estado real `active` retornou `active`.
- Em transacao com `rollback`, Empresa B alterada para `suspended` retornou `suspended`.
- Apos rollback, Empresa B continuou `active`.

Esse resultado confirma que a camada de acesso esta pronta para o app bloquear status suspenso/inativo com mensagem amigavel.

## Security Advisor - Atualizacao Pos-Usuarios

Security Advisor executado apos criacao dos usuarios e testes autenticados.

Avisos restantes:

- functions `SECURITY DEFINER` executaveis por `authenticated`;
- Leaked Password Protection desabilitado no Supabase Auth.

Classificacao:

- Functions `SECURITY DEFINER`: aceitas temporariamente, pois sao helpers/RPCs usados por RLS e fluxos clinicos. Devem ser reavaliadas depois do teste completo pela interface.
- Leaked Password Protection: recomendacao de hardening de Auth. Habilitar no painel Supabase antes da entrada real em producao.

Nao foi encontrado novo alerta critico de RLS/storage nos testes executados.

## Pendencias Antes de Dados Reais

1. Validar login real no app pelo navegador.
2. Testar abertura de atendimento pela interface.
3. Testar anamnese, imagens, relatorios, PDF e finalizacao pela interface.
4. Testar upload real de asset/logo pela interface.
5. Habilitar/revisar Leaked Password Protection no Supabase Auth.
6. Avaliar se RPCs restantes devem ser mantidos no schema `public`, movidos para schema privado ou migrados para Edge Functions.
7. Rodar Security Advisor novamente apos fluxo clinico completo pela interface.

## Conclusao

A base esta melhor endurecida para producao, os usuarios iniciais estao vinculados a suas empresas e o isolamento RLS/Storage passou em testes autenticados por banco com rollback. Ainda nao deve receber dados clinicos reais ate validacao de login e fluxo clinico completo pela interface.

Atualizacao de interface em 26/06/2026:

- Lint, typecheck e build passaram.
- Servidor local respondeu `HTTP 200`.
- Security Advisor foi executado novamente e nao trouxe alerta critico novo de RLS/Storage.
- `.env.local` nao existe neste workspace, entao login real pela interface ficou pendente.
- Relatorio detalhado: `docs/security/interface-production-validation-report.md`.
