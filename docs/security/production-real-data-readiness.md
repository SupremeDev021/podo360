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
- em 26/06/2026 foi encontrado e corrigido um bloqueio critico: a interface ainda permitia acesso em modo demo/sem sessao real.

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

## Bloqueio Critico Corrigido em 26/06/2026

Problema encontrado:

- A aplicacao entrava no sistema clinico sem usuario real.
- O login permitia fluxo equivalente a demo quando o ambiente Supabase nao estava configurado.
- O estado principal do app carregava dados demo e habilitava o layout interno com um estado local.

Correcoes:

- `src/App.tsx` deixou de usar `demoData` para autenticar/renderizar o sistema.
- `src/components/LoginScreen.tsx` exige e-mail, senha e retorno valido de `supabase.auth.signInWithPassword`.
- `isAuthenticated` efetivo agora depende de sessao real, usuario real, `profile` valido, `company_id` e empresa ativa.
- Acesso sem profile mostra mensagem amigavel de usuario nao vinculado.
- Empresa bloqueada/inativa mostra mensagem amigavel de indisponibilidade.
- Fallbacks de plataforma/status retornam `inactive`.
- Abertura de BA nao confirma sucesso quando falha a sincronizacao com Supabase.

Teste automatizado:

- Foi adicionado teste E2E que abre a aplicacao sem sessao, tenta entrar e confirma que a navegacao interna nao aparece.
- Os testes clinicos autenticados agora so rodam com credenciais reais fornecidas fora do Git via variaveis locais do Playwright.

Resultado:

- O bloqueio de acesso sem sessao foi corrigido.
- A validacao real com Usuarios A e B no navegador segue pendente antes de receber dados clinicos reais.

## Tela Branca e Ambiente Local - 26/06/2026

Foi investigada nova ocorrencia de pagina em branco apos a obrigatoriedade de autenticacao real.

Causa local encontrada:

- `.env.local` estava ausente no workspace, entao a aplicacao nao tinha as variaveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para autenticar no Supabase Podo360.

Acao segura:

- `.env.local` foi criado apenas localmente e continua protegido pelo Git.
- Nenhuma chave secreta, senha, token ou `service_role` foi commitado.
- Foi adicionado Error Boundary global para evitar tela branca total caso algum componente React falhe.

Validado:

- Tela de login renderiza.
- Rotas internas sem sessao nao entram.
- Navegacao interna nao aparece sem sessao real.
- Console do navegador nao apresentou erro critico no teste headless.
- Lint, typecheck, build e teste Playwright de bloqueio sem sessao passaram.

Ainda pendente apos a correcao de ambiente:

- Fluxo clinico completo autenticado com dados ficticios controlados.
- Isolamento visual multiempresa pela interface com dados criados e limpos de forma segura.
- Upload real, relatorios/PDF e status `suspended` pela interface.

## Validacao Real de Login - 27/06/2026

Resultado:

- Usuario A entrou pela interface e carregou Clinica Pe Saudavel.
- Usuario A carregou `company_id` `d4666e95-0278-4cfb-b805-0b93b6bc4d4a`.
- Usuario B entrou pela interface e carregou Clinica Teste Isolamento.
- Usuario B carregou `company_id` `b7cd6131-5565-406a-ac9c-eb5f0cce21f1`.
- Dashboard abriu para ambos.
- Nao houve tela branca nem erro critico de console.
- Logout foi validado com Usuario A.
- Acesso direto a rota protegida apos logout voltou para login.

Validacao de isolamento por sessao real:

- Usuario A consultou somente a propria empresa em `platform_companies`.
- Usuario B consultou somente a propria empresa em `platform_companies`.
- `patients` retornou contagem 0 para ambos sem erro de RLS.
- `platform_leads` retornou contagem 0 para ambos sem expor dados globais.

Status atualizado:

- Autenticacao obrigatoria e protecao basica de rotas estao aprovadas.
- Ainda nao declarar liberado para dados clinicos reais ate testar fluxo clinico completo com dados ficticios controlados, limpeza/rollback, upload real, relatorios/PDF, status `suspended` e Security Advisor com acesso ao projeto.

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

Atualizacao de interface em 26/06/2026:

- Lint, typecheck e build passaram.
- Servidor local respondeu `HTTP 200`.
- `.env.local` nao existe neste workspace, portanto a interface local ainda nao aponta ao Supabase oficial.
- Login real no navegador, fluxo clinico completo, relatorios/PDF, upload real e isolamento visual multiempresa continuam pendentes.
- Detalhes registrados em `docs/security/interface-production-validation-report.md`.

## Atualizacao de Administracao da Clinica - 28/06/2026

Correcoes aplicadas:

- `company_admin` voltou a acessar "Administracao da Clinica" pelo menu.
- A tela de funcionarios da clinica deixou de oferecer criacao de `super_admin`.
- A criacao de funcionarios deixou de pedir senha manual e passou a orientar convite seguro por e-mail.
- A Edge Function `admin-create-company-user` agora valida roles clinicos e limita `company_admin` a usuarios da propria empresa.
- A Edge Function foi implantada no projeto Supabase Podo360.

Validacoes executadas:

- Interface de Administracao da Clinica abriu para Usuario A.
- Modal de criacao de usuario abriu sem tela branca.
- Roles exibidas: apenas perfis clinicos.
- Campos de senha manual ausentes.
- Teste negativo da Edge Function bloqueou tentativa de criar `super_admin`.
- Teste negativo da Edge Function bloqueou tentativa de atualizar usuario de outra empresa.
- Lint, typecheck, build e Playwright do fluxo de administracao passaram.

Security Advisor em 28/06/2026:

- Executado via Supabase CLI.
- Sem alerta critico novo listado na saida resumida.
- Avisos restantes:
  - 15 functions `SECURITY DEFINER` executaveis por `authenticated`;
  - 1 aviso de Leaked Password Protection desabilitado;
  - 4 avisos `auth_rls_initplan`;
  - 29 avisos `multiple_permissive_policies`.

Decisao atual:

- Ainda nao apto para dados clinicos reais.
- Motivo: ainda falta executar fluxo clinico completo pela interface com dados ficticios e limpeza controlada: paciente, BA, PU, anamnese completa, upload real, relatorios/PDF, finalizacao/reabertura, status `suspended` pela interface e revisao dos avisos restantes.

Atualizacao de hardening RLS em 28/06/2026:

- Migration aplicada no Supabase Podo360: `20260628010709_optimize_rls_initplan_policies.sql`.
- Foram otimizadas 4 policies apontadas por `auth_rls_initplan`.
- Security Advisor reexecutado apos a migration:
  - total de avisos reduziu de 49 para 45;
  - `auth_rls_initplan` deixou de aparecer;
  - permanecem 29 `multiple_permissive_policies`, 15 `authenticated_security_definer_function_executable` e 1 `auth_leaked_password_protection`.

Decisao apos hardening:

- A reducao dos avisos melhora a postura de seguranca/performance.
- Ainda nao apto para dados clinicos reais ate concluir o fluxo clinico completo pela interface e revisar os avisos restantes sem quebrar RLS/RPCs do app.

Atualizacao de validacao de interface em 28/06/2026:

- Criada branch `codex/final-real-interface-validation-with-cleanup`.
- Lint, typecheck, build e Playwright sem sessao passaram.
- O teste sem sessao foi reforcado para validar rotas protegidas e credenciais invalidas.
- Security Advisor permanece em 45 avisos, sem `auth_rls_initplan`.
- Nenhum dado ficticio persistente foi criado.
- Nenhuma limpeza de dados foi necessaria.

Bloqueio atual:

- As variaveis locais de teste autenticado `PLAYWRIGHT_USER_A_EMAIL`, `PLAYWRIGHT_USER_A_PASSWORD`, `PLAYWRIGHT_USER_B_EMAIL` e `PLAYWRIGHT_USER_B_PASSWORD` nao estavam configuradas.
- As senhas reais nao foram gravadas em comandos, arquivos, logs ou documentos.
- Por isso, paciente/BA/PU/anamnese/upload/relatorios/finalizacao/reabertura/status suspended continuam pendentes pela interface.

## Atualizacao E2E Autenticada - 28/06/2026

As variaveis locais de teste autenticado foram configuradas em `.env.test.local`, arquivo ignorado pelo Git.

Validacoes aprovadas:

- Playwright autenticado: 11/11 testes aprovados.
- Login real do Usuario A.
- Login real do Usuario B.
- Bloqueio sem sessao real.
- Credenciais invalidas bloqueadas.
- Logout bloqueia rotas protegidas.
- Criacao real de paciente ficticio.
- Abertura real de BA.
- Geracao real de PU/Prontuario de Evolucao.
- Bloqueio de BA duplicado.
- Salvamento de Anamnese.
- Finalizacao com confirmacao.
- Cancelamento da finalizacao sem finalizar.
- Bloqueio de edicao apos finalizacao.
- Reabertura pelo Gerenciamento de Atendimento.
- Relatorio com IA sem JSON cru.
- Administracao da Clinica com convite seguro.

Bugs corrigidos:

- Paciente novo agora e persistido no Supabase antes da criacao do BA.
- BA local agora usa `id` e `ba_number` retornados pelo banco.
- Query remota de BA aberto nao usa mais status `reopened`, inexistente no enum remoto atual.
- Anamnese agora salva com UUID real em `anamnesis_records`.

Limpeza:

- Foram removidos 22 pacientes ficticios com prefixo `TESTE_PRODUCAO_PODO360_`, filtrando por `company_id` da Clinica Pe Saudavel.

Validacoes tecnicas finais:

- Lint: aprovado.
- Typecheck: aprovado.
- Build: aprovado.

Pendencias restantes:

- Upload real/Storage pela interface.
- Teste de status `suspended`/reativacao pela interface.
- Reexecucao do Supabase Security Advisor apos a rodada E2E completa.
- Habilitar ou documentar Leaked Password Protection no painel Supabase Auth.
- Confirmar se PUs gerados pelos pacientes ficticios foram removidos ou se ha registros orfaos em `unique_medical_records`.

Decisao atual:

- Ainda nao apto para producao com dados clinicos reais.
