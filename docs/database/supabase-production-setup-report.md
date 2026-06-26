# Relatório de Setup do Supabase Produção Podo360

## Projeto Confirmado

- Conta utilizada: conta oficial Podo360 informada pelo responsável.
- Projeto: Podo360.
- Project ref: `xnnt...zgtk`.
- Região: South America (São Paulo).
- Data da configuração: 25/06/2026.

## Remoção do vínculo anterior

O token anterior do Supabase CLI foi removido com `supabase logout`.

O repositório foi linkado novamente ao projeto Podo360 com o project ref oficial. O vínculo local fica em `supabase/.temp`, que foi incluído no `.gitignore` para evitar commit acidental.

## Credenciais

Nenhuma credencial foi versionada.

Não foram commitados:

- `.env`
- `.env.local`
- chave `service_role`
- chave secreta
- senha
- token de acesso Supabase
- arquivos temporários do Supabase CLI

## Estado do banco antes das migrations

Antes do `db push`, o projeto Podo360 não possuía tabelas no schema `public`.

O schema `storage` possuía tabelas padrão do Supabase.

O histórico remoto `supabase_migrations` ainda não existia antes da primeira aplicação.

Foi tentado gerar dump de schema antes das migrations, mas o Supabase CLI exigiu Docker Desktop para `db dump`, e o Docker não estava disponível neste ambiente. Como o schema `public` estava vazio, não havia dados clínicos ou de plataforma a preservar.

## Migrations revisadas e aplicadas

Foram aplicadas no Supabase Podo360 as migrations:

- `001_initial_schema.sql`
- `002_unique_medical_record_ba_anamnesis_hci.sql`
- `003_hospital_ba_flow_completion.sql`
- `004_attendance_images_evolution.sql`
- `005_clinical_agenda.sql`
- `006_stock_financial_notes.sql`
- `007_agenda_permissions_products.sql`
- `008_refine_products_users_agenda_finance.sql`
- `009_standard_podology_product_catalog.sql`
- `010_stock_soft_delete_attendance_used_products.sql`
- `011_whitelabel_sidebar_colors.sql`
- `012_company_assets_logo_storage.sql`
- `013_clinic_admin_autoclave_scope.sql`
- `014_autoclave_stock_links.sql`
- `015_attendance_reopen_audit_lock.sql`
- `016_platform_plans_admin_integration.sql`

## Ajuste feito na migration 002

A migration `002_unique_medical_record_ba_anamnesis_hci.sql` falhou inicialmente porque a função `digest(...)` do `pgcrypto` não estava disponível no `search_path` padrão do projeto Supabase.

Correção aplicada:

- `digest(...)` foi alterado para `extensions.digest(...)`.

Depois do ajuste, o `db push` continuou da migration 002 e concluiu até a migration 016.

## SQL destrutivo

Não foi executado `db reset`.

Não foi executado SQL manual destrutivo.

As ocorrências de `drop policy if exists`, `drop trigger if exists` e alterações semelhantes fazem parte de migrations idempotentes para recriar policies/triggers com segurança. Como o schema público estava vazio antes da aplicação, não havia dados de produção a remover.

## Tabelas validadas

Após as migrations, foram validadas tabelas clínicas e de plataforma, incluindo:

- `companies`
- `profiles`
- `patients`
- `attendances`
- `anamnesis_records`
- `foot_sensitivity_maps`
- `attendance_images`
- `attendance_audit_logs`
- `platform_companies`
- `platform_plans`
- `platform_features`
- `platform_announcements`
- `platform_admin_users`

O schema `public` ficou com 45 tabelas.

## Planos comerciais validados

Foram validados os planos iniciais:

- `start`: R$ 197,00/mês e setup R$ 497,00
- `clinic`: R$ 397,00/mês e setup R$ 997,00
- `pro`: R$ 697,00/mês e setup R$ 1.497,00
- `master`: R$ 997,00/mês e setup R$ 2.497,00

Também foram validadas 23 features cadastradas em `platform_features`.

## RLS e company_id

As tabelas sensíveis foram criadas com RLS habilitado.

Validações executadas:

- contagem de tabelas públicas;
- contagem de tabelas com RLS;
- busca por tabelas públicas sem RLS;
- validação das tabelas principais por `company_id` nas migrations;
- validação da estrutura de plataforma/admin separada.

Nenhuma tabela pública apareceu como explicitamente sem RLS na consulta final de verificação.

## Advisors Supabase

Foram executados advisors de segurança e performance.

Avisos encontrados:

- funções `SECURITY DEFINER` executáveis por `anon`/`authenticated`;
- funções com `search_path` mutável;
- extensão `unaccent` instalada no schema `public`;
- bucket público `company-assets` com policy ampla de listagem;
- policies RLS com chamadas que podem ser otimizadas usando `(select auth.uid())`;
- múltiplas policies permissivas para algumas tabelas.

Esses avisos não bloquearam a criação do banco, mas devem ser tratados em uma etapa de hardening específica, com testes funcionais completos, porque revogar permissões de funções usadas por policies/RPCs pode quebrar login, BA, atendimento, finalização e gerenciamento.

## O que não foi feito

- Não foi criado usuário administrativo inicial com senha fixa.
- Não foi inserida senha em SQL.
- Não foi exposta chave `service_role`.
- Não foi aplicado `db reset`.
- Não foram apagados dados.
- Não foi configurado gateway de pagamento.
- Não foi bloqueado módulo por plano no Sistema Clínica.

## Próximas pendências

1. Criar o primeiro usuário/Auth no Supabase Podo360 de forma segura.
2. Criar o primeiro registro `profile` e vínculo com `company_id`.
3. Criar o primeiro registro `platform_admin_users` para liberar acesso ao `podo360-admin`.
4. Configurar variáveis locais/produção com a URL e chave pública do projeto Podo360, sem versionar `.env`.
5. Testar login real.
6. Testar abertura de atendimento.
7. Testar anamnese, BA, Prontuário de Evolução, Agenda, Relatórios e Gerenciamento.
8. Planejar migration de hardening para advisors Supabase.
