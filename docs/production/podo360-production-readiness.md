# Prontidão de Produção do Sistema Clínica Podo360

## Objetivo

Este documento organiza a preparação do repositório `podo360` como Sistema Clínica. Ele não cria integração real com produção, não adiciona chaves, não aplica migrations e não define cobrança.

O `podo360` continua responsável pela operação clínica das empresas contratantes:

- BA.
- Atendimentos.
- Pacientes.
- ProntuárioÚnico.
- Anamnese.
- Pé 3D / Sensibilidade Monofilamento.
- Curativos e imagens.
- Agenda.
- Financeiro da clínica.
- Estoque e produtos da clínica.
- Relatórios clínicos.
- Administração da própria clínica.
- White Label da própria clínica.
- Gerenciamento de Atendimento e auditoria clínica.

## Checklist de Produção

- Confirmar que o repositório atual continua sendo apenas Sistema Clínica.
- Confirmar que não há painel comercial global da Podo360 dentro do sistema clínico.
- Confirmar que cada tela operacional respeita `company_id`.
- Confirmar que `.env` e `.env.local` não estão versionados.
- Confirmar que `.gitignore` protege arquivos sensíveis e artefatos temporários.
- Rodar `npm run lint`.
- Rodar `npm run typecheck`.
- Rodar `npm run build`.
- Rodar testes automatizados quando estiverem configurados no projeto.
- Validar manualmente telas críticas antes de deploy real.
- Revisar RLS e permissões no projeto Supabase correto antes de produção.

## Variáveis de Ambiente

Usar `.env.example` como base, sem inserir valores reais na documentação:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=
VITE_AI_PROVIDER=
VITE_AI_REFERRAL_FUNCTION_URL=
```

Regras:

- Nunca versionar `.env`.
- Nunca expor `service_role` no frontend.
- Chaves privadas de IA, integrações e Supabase devem ficar em backend, Supabase Edge Functions ou provedor serverless.
- Variáveis com prefixo `VITE_` são públicas no navegador.

## Scripts Disponíveis

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run preview
```

Se Playwright estiver instalado e configurado:

```bash
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:headed
```

## Como Rodar Localmente

```bash
npm install
npm run dev
```

Depois abrir a URL indicada pelo Vite, normalmente:

```text
http://localhost:5173/
```

## Como Validar Build

```bash
npm run lint
npm run typecheck
npm run build
```

O build só deve ser considerado pronto se passar sem erros de TypeScript, import quebrado ou lint.

## Cuidados com Supabase

- Usar apenas chave pública/anon no frontend.
- Manter `service_role` fora do frontend.
- Revisar Auth Redirect URLs antes de produção.
- Validar Storage buckets necessários para logos e anexos.
- Validar policies antes de abrir acesso para usuários reais.
- Não usar `user_metadata` como fonte confiável de autorização.
- Preferir dados de autorização em tabelas internas e policies com RLS.

## Cuidados com RLS

- Todas as tabelas clínicas devem respeitar `company_id`.
- Policies devem garantir que cada clínica acesse somente seus próprios dados.
- Updates precisam de policies de `SELECT` e `UPDATE`.
- Tabelas expostas pela Data API devem ter RLS ativo.
- Funções privilegiadas devem ser cuidadosamente revisadas antes de produção.

## Status da Empresa

O sistema foi preparado para reconhecer os status futuros:

- `active`
- `trial`
- `inactive`
- `suspended`
- `cancelled`

Mensagem padrão para bloqueio futuro:

> O acesso da sua clínica está temporariamente indisponível. Entre em contato com o suporte Podo360.

Nesta fase, o bloqueio definitivo ainda não é aplicado por integração com `podo360-admin`. A camada preparada fica em `src/services/companyStatusService.ts`.

## Integração Futura com `podo360-admin`

O `podo360-admin` será responsável por:

- Criar empresas contratantes.
- Alterar status da empresa.
- Registrar auditoria administrativa.
- Preparar vínculo de planos futuros.

O Sistema Clínica deverá consultar somente o status e recursos da própria empresa, sem acessar leads, lista global de clientes ou dados comerciais da plataforma.

## Integração Futura com `podo360-landing`

A Landing Page deverá:

- Captar leads.
- Enviar leads para API ou Edge Function segura.
- Direcionar usuários para o login do sistema clínico.

A Landing Page não deve acessar dados clínicos nem usar credenciais privilegiadas.

## Validação Manual Recomendada

Antes do deploy real, revisar:

- Login.
- Dashboard.
- Abertura de BA.
- Pesquisar Paciente.
- Atendimentos.
- Atendimento individual.
- Anamnese.
- Pé 3D / Sensibilidade Monofilamento.
- Curativos.
- Imagens.
- Finalização de atendimento.
- Gerenciamento de Atendimento.
- Financeiro.
- Estoque.
- Produtos.
- Relatórios.
- Administração da Clínica.
- White Label.
- Registro de Autoclave.

## Pendências Antes do Deploy Real

- Validar projeto Supabase real.
- Revisar e aplicar migrations no ambiente correto.
- Configurar Auth e redirects.
- Configurar Storage.
- Definir estratégia de seed/admin inicial.
- Revisar políticas RLS em ambiente real.
- Decidir provedor de deploy.
- Configurar variáveis reais no provedor de deploy.
- Criar os repositórios `podo360-landing` e `podo360-admin`.
- Implementar integração segura entre Landing, Admin e Clínica.
- Definir planos e feature flags em etapa futura, sem cobrança nesta fase.
