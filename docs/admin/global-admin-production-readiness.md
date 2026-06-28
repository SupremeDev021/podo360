# Admin Global - Prontidao de Producao

Data: 28/06/2026

Projeto Supabase: Podo360 (`xnnt...zgtk`)

## Objetivo

Preparar a area de Admin Global para producao real, separada do sistema clinico, sem dados mockados e usando Supabase Auth + RLS.

## Implementacao

Arquivos criados/alterados:

- `src/components/GlobalAdminApp.tsx`
- `src/services/globalAdminService.ts`
- `src/services/platformAnnouncementsService.ts`
- `src/App.tsx`
- `src/styles.css`
- `tests/e2e/podo360-global-admin.spec.ts`

## Autenticacao

O Admin Global possui login proprio em:

- `/admin/login`

Rotas protegidas:

- `/admin`
- `/admin/dashboard`
- `/admin/empresas`
- `/admin/planos`
- `/admin/assinaturas`
- `/admin/leads`
- `/admin/usuarios`
- `/admin/avisos`
- `/admin/auditoria`
- `/admin/configuracoes`

Regras implementadas:

- Sem sessao Supabase real, o Admin Global mostra login.
- E-mail vazio nao entra.
- Senha vazia nao entra.
- Credenciais invalidas nao entram.
- Usuario autenticado sem registro ativo em `platform_admin_users` nao acessa.
- Usuario de clinica comum nao vira admin global automaticamente.
- Acesso negado mostra: "Seu usuario nao possui permissao para acessar o Admin Global Podo360."
- Admin inativo mostra: "Seu acesso administrativo esta inativo. Entre em contato com o responsavel pela plataforma."
- Logout chama `supabase.auth.signOut()`.

## Permissao

Permissao real usada:

- tabela `platform_admin_users`
- campos: `user_id`, `role`, `active`

Roles suportadas pelo schema atual:

- `owner`
- `admin`
- `support`
- `commercial`

Observacao:

- O prompt citou tambem `finance` e `operations`, mas o schema real possui constraint para `owner`, `admin`, `support` e `commercial`.
- Nao foi criada migration para alterar essa constraint nesta etapa, para evitar mudanca de banco desnecessaria sem validacao comercial.

## Integracao Supabase Real

Tabelas integradas no frontend com RLS:

- `platform_admin_users`
- `platform_companies`
- `platform_plans`
- `platform_company_subscriptions`
- `platform_features`
- `platform_leads`
- `platform_announcements`
- `platform_admin_audit_logs`
- `platform_company_status_logs`
- `profiles` somente para complementar nome/e-mail de admins quando RLS permitir

Nenhuma consulta usa `service_role`.

## Dashboard Global

Cards com dados reais:

- total de empresas;
- empresas ativas;
- empresas suspensas;
- leads;
- planos ativos;
- assinaturas ativas;
- avisos ativos;
- logs de auditoria carregados.

Se nao houver dados, os valores aparecem como zero ou estado vazio.

## Telas Implementadas

### Empresas

- Lista empresas reais de `platform_companies`.
- Busca por nome, responsavel/e-mail e status.
- Mostra `company_id`, plano e CNPJ.
- Permite alterar status entre `active`, `trial`, `inactive`, `suspended` e `cancelled`.
- Registra `platform_company_status_logs`.
- Registra `platform_admin_audit_logs`.
- Suspensao reflete no app clinico via `company_platform_access`.

### Planos

- Lista planos reais de `platform_plans`.
- Cria plano.
- Edita plano.
- Ativa/inativa plano.
- Atualiza mensalidade, setup, descricao, ordem e flag de valor sob consulta.
- Registra auditoria.

### Assinaturas

- Lista assinaturas reais de `platform_company_subscriptions`.
- Mostra empresa, plano, status, valor mensal, renovacao e observacoes.
- Estado vazio amigavel quando nao houver registros.

### Leads

- Lista leads reais de `platform_leads`.
- Busca por lead, clinica, e-mail ou status.
- Atualiza status.
- Registra auditoria.

### Usuarios Administrativos

- Lista `platform_admin_users`.
- Permite ativar/inativar.
- Permite alterar role dentro das roles suportadas pelo schema.
- Registra auditoria.
- Nao cria usuario Auth nem senha no frontend.

### Avisos Globais

- Lista `platform_announcements`.
- Cria aviso.
- Edita aviso.
- Ativa/desativa aviso.
- Define severidade, periodo e se e fechavel.
- O sistema clinico agora consulta `platform_announcements` real pelo Supabase quando configurado.

### Auditoria

- Lista `platform_admin_audit_logs`.
- Permite busca textual por acao, entidade e detalhes.
- Nao exibe dados mockados.

### Configuracoes

- Mostra configuracoes versionadas reais do app, como site oficial e WhatsApp de suporte.
- Nao grava configuracao mockada.

## Mocks

Busca realizada no codigo indicou que o app clinico ainda possui `src/data/demoData.ts`, mas o fluxo autenticado do sistema clinico nao usa esse arquivo para liberar acesso.

Para o Admin Global:

- nao foi criado mock;
- nao existe usuario hardcoded;
- nao existe senha hardcoded;
- nao existe fallback demo;
- nao existe localStorage simulando admin;
- estados vazios substituem qualquer dado ausente.

## Validacoes

Executado:

- Lint: aprovado.
- Typecheck: aprovado.
- Build: aprovado.
- Playwright Admin Global:
  - sem sessao exibe login;
  - rota direta `/admin/empresas` sem sessao exibe login;
  - campos vazios bloqueiam;
  - credenciais invalidas bloqueiam;
  - usuario clinico comum autenticado e bloqueado;
  - platform admin real acessa o Dashboard Global;
  - Dashboard Global carrega dados reais;
  - Empresas carrega dados reais do Supabase.

Resultado Playwright:

- 4 testes aprovados.
- 0 testes skipados.

## Admin Global Ativo

Registro validado em `platform_admin_users`:

- usuario Auth real ja existente;
- role: `owner`;
- `active = true`;
- sem criacao ou versionamento de senha;
- sem migration com senha;
- sem uso de `service_role` no frontend.

Observacao de seguranca:

- O primeiro Admin Global foi concedido explicitamente ao Usuario A.
- O Usuario B permanece clinico comum e foi usado para validar bloqueio de acesso ao Admin Global.
- `company_admin` nao vira `platform_admin` automaticamente; o acesso global depende do registro ativo em `platform_admin_users`.

Variaveis locais usadas para teste autorizado:

```env
PLAYWRIGHT_PLATFORM_ADMIN_EMAIL=
PLAYWRIGHT_PLATFORM_ADMIN_PASSWORD=
```

Valores reais ficaram apenas em variaveis locais/processo e nao foram versionados.

Comando validado:

```bash
npx playwright test podo360-global-admin
```

## Leaked Password Protection

Permanece como pendencia operacional nao bloqueante ja documentada:

- Leaked Password Protection nao foi habilitado porque o painel Supabase indicou exigencia de plano Pro ou superior.
- Reavaliar apos upgrade do plano/projeto.

## Decisao

Admin Global apto para producao.

Motivos:

- existe `platform_admin_user` ativo;
- role `owner` validada;
- login real Supabase Auth validado;
- usuario clinico comum bloqueado;
- teste E2E autorizado passou;
- telas do Admin usam Supabase real;
- sem mock, senha hardcoded ou `service_role` no frontend.

Pendencia operacional nao bloqueante antes do go-live final:

- Leaked Password Protection exige Supabase Pro ou superior no projeto atual.

## Correcao de Tela Branca e Mensagens - 28/06/2026

Causa identificada:

- O Admin separado `podo360-admin` estava com `index.html` apontando para assets antigos de build, o que podia gerar tela branca em deploy estatico.
- O Admin Global integrado no `podo360` tinha mensagens tecnicas de ambiente Supabase quando a autenticacao nao estava configurada.

Correcoes:

- `podo360-admin/index.html` voltou ao entrypoint Vite correto em `/src/main.tsx`.
- O painel mockado/read-only do `podo360-admin` foi removido; o repo separado agora exibe login/setup seguro sem dados falsos.
- O Admin Global integrado passou a exibir mensagem amigavel de indisponibilidade em producao, sem citar Supabase.

Validado:

- Build do `podo360-admin`: aprovado.
- Admin Global `/admin` sem sessao mostra login.
- Platform admin real acessa Dashboard Global.
- Usuario clinico comum e bloqueado.
