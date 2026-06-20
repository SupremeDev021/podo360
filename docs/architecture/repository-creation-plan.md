# Plano de Criação dos Repositórios Podo360

## Objetivo

Este plano define como criar os repositórios separados da plataforma Podo360 sem misturar responsabilidades dentro do Sistema Clínica.

## Repositórios

### `podo360`

Sistema Clínica já existente.

Responsável por:

- Operação clínica diária.
- BA, atendimentos, pacientes e ProntuárioÚnico.
- Anamnese, Pé 3D, curativos e imagens.
- Agenda, financeiro, estoque, produtos e relatórios da clínica.
- Administração da própria clínica.
- White Label da própria clínica.
- Gerenciamento de Atendimento e auditoria clínica.

Não deve:

- Gerenciar leads da plataforma.
- Listar todas as empresas contratantes.
- Ativar ou suspender empresas globalmente.
- Gerenciar cobrança global.
- Definir planos comerciais da plataforma.

### `podo360-landing`

Landing Page pública.

Stack sugerida:

- React.
- Vite.
- TypeScript.
- CSS modular ou Tailwind, a decidir no momento da criação.

Estrutura inicial sugerida:

```text
src/
  components/
  sections/
  services/
  styles/
  App.tsx
  main.tsx
public/
docs/
```

Responsável por:

- Página institucional.
- Apresentação do produto.
- Formulário de interesse.
- Botões comerciais.
- FAQ.
- Direcionamento para login do Sistema Clínica.

### `podo360-admin`

Sistema interno da Podo360.

Stack sugerida:

- React.
- Vite.
- TypeScript.
- Supabase Auth.
- Supabase Postgres com RLS.

Estrutura inicial sugerida:

```text
src/
  components/
  pages/
  services/
  hooks/
  types/
  App.tsx
  main.tsx
supabase/
  migrations/
docs/
```

Responsável por:

- Leads.
- Empresas contratantes.
- Status de acesso.
- Auditoria administrativa.
- Planos futuros.
- Feature flags futuras.

## Fluxo Landing -> Admin

1. Usuário preenche o formulário da Landing.
2. Landing envia os dados para uma API ou Supabase Edge Function.
3. A API valida o payload.
4. A API grava em `platform_leads`.
5. O lead aparece no `podo360-admin`.
6. A equipe Podo360 acompanha e converte em empresa, se fechar contrato.

Regras:

- Landing apenas cria lead.
- Landing não lista leads.
- Landing não usa `service_role` no frontend.
- API deve validar dados e aplicar proteção contra abuso.

## Fluxo Admin -> Clínica

1. Admin cria ou atualiza empresa.
2. Admin define status da empresa.
3. Sistema Clínica identifica o `company_id` do usuário.
4. Sistema Clínica consulta somente o status da própria empresa.
5. Acesso é liberado ou bloqueado com mensagem amigável.

Status previstos:

- `active`
- `trial`
- `inactive`
- `suspended`
- `cancelled`

## Variáveis de Ambiente Futuras

### `podo360-landing`

```bash
VITE_APP_URL=
VITE_CLINIC_APP_URL=
VITE_LEAD_CAPTURE_ENDPOINT=
VITE_WHATSAPP_URL=
```

### `podo360-admin`

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=
```

### `podo360`

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=
VITE_AI_PROVIDER=
VITE_AI_REFERRAL_FUNCTION_URL=
```

Nenhum repositório frontend deve receber chave `service_role`.

## Ordem Segura de Criação

1. Revisar e aprovar a arquitetura.
2. Manter `podo360` como Sistema Clínica.
3. Criar `podo360-landing`.
4. Implementar Landing institucional sem integração real de produção.
5. Criar `podo360-admin`.
6. Implementar autenticação administrativa.
7. Criar estrutura de leads e empresas no Admin.
8. Criar API/Edge Function para captação de leads.
9. Conectar Landing -> API -> Admin.
10. Preparar validação Admin -> Clínica.
11. Só depois definir planos, feature flags e cobrança.

## O Que Não Fazer Agora

- Não criar Landing dentro do `podo360`.
- Não criar Admin dentro do `podo360`.
- Não colocar chaves reais no código.
- Não integrar Supabase produção sem validação.
- Não criar cobrança.
- Não definir preços finais.
- Não bloquear módulos por plano.
- Não permitir que o Sistema Clínica consulte leads ou lista global de empresas.
