# Prontidao para Dados Clinicos Reais - Podo360

Data: 25/06/2026

Projeto Supabase: Podo360 (`xnnt...zgtk`)

## Status Atual

Ainda nao liberado para dados clinicos reais.

Motivo principal:

- os usuarios Auth e os `profiles` foram criados e validados no banco;
- o isolamento multiempresa foi validado por simulacao autenticada no banco com `rollback`;
- o login real visual no app ainda precisa ser confirmado no navegador com as senhas criadas fora do repositorio;
- o fluxo clinico completo via interface ainda precisa ser executado pelo responsavel antes de receber dados clinicos reais.

## Itens Ja Validados

- Migrations do sistema clinico e plataforma/admin aplicadas.
- Empresa inicial criada: Clinica Pe Saudavel.
- Segunda empresa de isolamento criada: Clinica Teste Isolamento.
- Ambas possuem `company_settings`.
- Ambas possuem vinculo em `platform_companies`.
- Ambas possuem assinatura comercial em `platform_company_subscriptions`.
- RLS esta habilitado nas tabelas publicas revisadas.
- Bucket `company-assets` teve listagem publica ampla removida.
- Funcoes sem `search_path` foram corrigidas.
- Execucao de functions por `anon` foi revogada.
- Execucao direta de functions internas por `authenticated` foi restringida.
- Teste transacional com rollback validou geracao de BA e PU.
- Nenhum dado clinico de teste ficou persistido.
- Usuario da Clinica Pe Saudavel criado em `auth.users` e vinculado em `profiles`.
- Usuario da Clinica Teste Isolamento criado em `auth.users` e vinculado em `profiles`.
- `current_company_id`, `current_role` e `is_platform_admin` validados para os dois usuarios.
- Teste multiempresa autenticado por RLS validado com transacao e `rollback`.
- Storage `company-assets` validado por RLS com objetos temporarios e `rollback`.
- Status `suspended` validado na view `company_platform_access` com `rollback`.

## Itens Bloqueantes

1. Validar login real no app pelo navegador.
2. Validar fluxo clinico principal pela interface.
3. Validar criacao real de paciente/BA/anamnese pela interface.
4. Validar relatorios, impressao e PDF pela interface.
5. Validar upload real de logo/asset pela interface.
6. Habilitar Leaked Password Protection no Supabase Auth, se desejado para producao.
7. Reavaliar se RPCs `SECURITY DEFINER` devem ser movidas para schema privado/Edge Functions em etapa posterior.

## Setup Inicial Preparado

Foi preparado um caminho seguro para criacao do primeiro usuario sem versionar senha:

- Tela do Admin: `/admin/setup`
- Guia: `docs/setup/criar-primeiro-usuario-podo360.md`
- Script exemplo: `scripts/setup/create-initial-user.example.ts`

A tela `/admin/setup` nao usa `service_role` no navegador e nao salva senha. Ela orienta a criacao do usuario no Supabase Auth e gera o SQL para vincular o `profile` ao `company_id` correto.

Arquivos locais reais com senha devem usar o sufixo `.local.ts`, que esta protegido no `.gitignore`.

## Procedimento Seguro para Criar Usuarios

Nao criar usuario com senha em migration versionada.

Preferencia:

1. Criar usuarios pelo painel Supabase Auth.
2. Definir senhas fora do repositorio.
3. Copiar o `user_id` gerado.
4. Inserir os registros em `profiles` com `company_id` correto.

Exemplo logico, sem valores reais:

```sql
insert into public.profiles (id, company_id, full_name, email, role, active)
values (
  '<auth_user_id>',
  '<company_id>',
  'Administrador da Clinica',
  '<email_do_usuario>',
  'company_admin',
  true
);
```

Para usuario platform admin, somente se necessario:

```sql
insert into public.platform_admin_users (user_id, role, active)
values ('<auth_user_id>', 'owner', true);
```

## Teste Multiempresa Obrigatorio

Empresa A:

- Clinica Pe Saudavel

Empresa B:

- Clinica Teste Isolamento

Checklist:

- Usuario A cria paciente A.
- Usuario A cria atendimento A.
- Usuario A preenche anamnese A.
- Usuario B nao visualiza paciente A.
- Usuario B nao visualiza atendimento A.
- Usuario B nao visualiza anamnese A.
- Usuario B nao acessa configuracoes da Empresa A.
- Usuario B cria paciente B.
- Usuario A nao visualiza paciente B.
- Usuario A nao visualiza atendimento B.
- Usuario clinico comum nao acessa `platform_leads`.
- Usuario clinico comum nao altera `platform_plans`.
- Usuario clinico comum nao lista `platform_companies` globalmente.

Resultado em 25/06/2026:

- Empresa A autenticada simulada por `auth.uid()` viu 1 paciente, 1 atendimento e 1 anamnese proprios.
- Empresa A autenticada simulada nao viu paciente, atendimento ou anamnese da Empresa B.
- Empresa B autenticada simulada por `auth.uid()` viu 1 paciente, 1 atendimento e 1 anamnese proprios.
- Empresa B autenticada simulada nao viu paciente, atendimento ou anamnese da Empresa A.
- Usuarios clinicos simulados nao visualizaram `platform_leads`.
- Usuarios clinicos simulados nao visualizaram `platform_admin_audit_logs`.
- Todos os registros clinicos criados para o teste foram revertidos com `rollback`.

Este teste valida as policies RLS no banco. Ainda falta repetir os fluxos pela interface com login real no navegador.

## Usuarios e Profiles Validados

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

Senhas nao foram registradas, versionadas ou documentadas.

## Storage Validado

Bucket:

- `company-assets`

Resultado:

- Empresa A autenticada simulada viu apenas asset no caminho da propria empresa.
- Empresa A nao viu asset temporario da Empresa B.
- Empresa B autenticada simulada viu apenas asset no caminho da propria empresa.
- Empresa B nao viu asset temporario da Empresa A.
- Objetos de teste foram revertidos com `rollback`.
- Listagem publica ampla continua removida.

## Status da Empresa

Validacao:

- Empresa B em `active` aparece como `active` na view `company_platform_access`.
- Em transacao com `rollback`, Empresa B alterada para `suspended` apareceu como `suspended` na view.
- Apos rollback, Empresa B continuou `active`.

O app deve usar esta informacao para exibir a mensagem amigavel de bloqueio quando o status nao permitir acesso.

## RPCs e Functions Restantes

Security Advisor ainda aponta functions `SECURITY DEFINER` executaveis por `authenticated`.

Mantidas temporariamente por uso em RLS/RPC real:

- `can_access_company`
- `current_company_id`
- `current_profile`
- `current_role`
- `has_clinical_write_access`
- `has_financial_access`
- `has_attendance_management_access`
- `mark_attendance_started`
- `mark_attendance_finished`
- `cancel_attendance_finalization`
- funcoes HCI de permissao/consentimento
- funcoes de checagem admin

Decisao:

- Nao revogar agora sem teste completo pela interface, pois pode quebrar fluxos clinicos.
- Reavaliar apos testes reais no navegador.
- Considerar mover RPCs sensiveis para schema privado ou Edge Functions em etapa posterior.

Security Advisor em 25/06/2026:

- Sem alerta critico novo de RLS/storage nas validacoes executadas.
- Warnings restantes: functions `SECURITY DEFINER` executaveis por `authenticated`, aceitas temporariamente porque sao helpers/RPCs do app.
- Warning adicional: Leaked Password Protection desabilitado no Supabase Auth. Recomenda-se habilitar no painel do Supabase antes da producao real.

## Criterio de Liberacao

Somente declarar pronto para dados clinicos reais quando:

- usuario inicial existir;
- login real funcionar;
- `company_id` carregar corretamente;
- fluxo clinico principal funcionar;
- BA e PU forem gerados;
- Anamnese salvar e recarregar;
- Storage funcionar com isolamento;
- relatorios/PDF funcionarem;
- teste multiempresa passar;
- Security Advisor nao tiver alerta critico aberto;
- `.env` e credenciais continuarem fora do Git;
- `service_role` nao estiver no frontend;
- lint, typecheck e build estiverem aprovados.

## Conclusao

O banco esta estruturado e endurecido em uma boa base inicial. Os usuarios Auth e profiles ja foram criados com vinculo correto, e os testes autenticados de RLS/Storage passaram por simulacao segura com rollback.

Ainda nao liberar dados clinicos reais ate validar login visual, fluxo clinico completo, relatorios/PDF e upload real pela interface usando as senhas criadas fora do repositorio.
