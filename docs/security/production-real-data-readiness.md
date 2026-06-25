# Prontidao para Dados Clinicos Reais - Podo360

Data: 25/06/2026

Projeto Supabase: Podo360 (`xnnt...zgtk`)

## Status Atual

Ainda nao liberado para dados clinicos reais.

Motivo principal:

- ainda nao existe usuario real em `auth.users`;
- ainda nao existe `profile` vinculado a `company_id`;
- login real no app ainda nao foi validado;
- teste multiempresa autenticado ainda nao foi executado.

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

## Itens Bloqueantes

1. Criar usuario da Clinica Pe Saudavel no Supabase Auth.
2. Criar `profile` com role `company_admin` para a Clinica Pe Saudavel.
3. Criar usuario da Clinica Teste Isolamento no Supabase Auth.
4. Criar `profile` com role adequada para a Clinica Teste Isolamento.
5. Validar login real no app.
6. Validar fluxo clinico principal com RLS real.
7. Validar isolamento Empresa A x Empresa B.
8. Validar Storage com usuarios reais.
9. Validar status `suspended`/reativacao.
10. Reavaliar Security Advisor apos testes autenticados.

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

- Nao revogar agora sem login real, pois pode quebrar fluxos clinicos.
- Reavaliar apos testes autenticados.
- Considerar mover RPCs sensiveis para schema privado ou Edge Functions em etapa posterior.

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

O banco esta estruturado e endurecido em uma boa base inicial, e o fluxo seguro de setup do primeiro usuario foi preparado. A liberacao para dados clinicos reais ainda depende obrigatoriamente da criacao segura dos usuarios Auth e da validacao multiempresa autenticada.
