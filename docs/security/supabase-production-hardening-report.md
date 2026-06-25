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

O projeto ainda nao possui usuarios em `auth.users`.

Por seguranca, nenhum usuario com senha foi criado por migration ou script versionado.

Procedimento recomendado:

1. Criar o usuario inicial pelo painel Supabase Auth ou por script local nao versionado.
2. Criar o registro correspondente em `profiles`, vinculado ao `company_id` da Clinica Pe Saudavel.
3. Usar role `company_admin` para o dono/admin da clinica.
4. Se o mesmo usuario tambem for administrar a plataforma, criar registro em `platform_admin_users`.
5. Nunca versionar senha, token, `service_role` ou arquivo `.env`.

Estado validado em 25/06/2026:

- `auth.users`: 0 usuarios
- `profiles`: 0 perfis
- Clinica Pe Saudavel: 0 perfis vinculados
- Clinica Teste Isolamento: 0 perfis vinculados

Portanto, login real e teste multiempresa autenticado ainda nao puderam ser executados.

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

Foi criada a segunda empresa, mas ainda nao foi criado usuario real nem profile autenticado para nenhuma das empresas.

Teste pendente:

- criar usuario da Empresa A;
- criar usuario da Empresa B;
- validar que Empresa A nao acessa pacientes, atendimentos, imagens, financeiro, estoque ou configuracoes da Empresa B;
- validar que usuario clinico comum nao acessa `platform_leads` nem listagem global de `platform_companies`.

## Validacao do App

Login real ainda nao foi validado porque nao existe usuario em `auth.users`.

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

## Pendencias Antes de Dados Reais

1. Criar usuario inicial no Supabase Auth de forma segura.
2. Vincular o usuario em `profiles` com `company_id` da Clinica Pe Saudavel.
3. Criar usuario da Clinica Teste Isolamento de forma segura.
4. Vincular o usuario da Empresa B em `profiles`.
5. Validar login no app.
6. Testar abertura de atendimento com RLS real.
7. Testar anamnese, imagens, relatorios, PDF e finalizacao.
8. Testar isolamento multiempresa com segunda empresa/usuario.
9. Avaliar se RPCs restantes devem ser mantidos no schema `public`, movidos para schema privado ou migrados para Edge Functions.
10. Rodar Security Advisor novamente apos login real e testes funcionais.

## Conclusao

A base esta melhor endurecida para producao e as duas empresas de teste estao preparadas, mas ainda nao deve receber dados clinicos reais ate a criacao dos usuarios iniciais, validacao de login e teste multiempresa com usuarios autenticados.
