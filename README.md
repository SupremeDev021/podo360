# Podo360

Podo360 e um sistema de gestao para clinicas de podologia. O projeto organiza pacientes, anamnese, atendimentos, agenda, financeiro, estoque, relatorios, encaminhamento medico com IA e mapa corporal/curativos em 3D.

## Stack

- Vite + React + TypeScript
- Supabase Auth, Postgres e Row Level Security
- CSS responsivo com identidade visual configuravel
- Corpo humano 3D com Three.js / React Three Fiber no mapa corporal
- Servicos separados para facilitar futura evolucao para React Native ou Expo

## Como rodar

```bash
npm install
npm run dev
```

Crie um arquivo `.env` baseado em `.env.example`:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
VITE_APP_URL=http://localhost:5173
VITE_AI_PROVIDER=mock
VITE_AI_REFERRAL_FUNCTION_URL=
```

## Configuracao do Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Execute o arquivo `supabase/migrations/001_initial_schema.sql`.
4. Configure o provedor de Auth desejado.
5. Cadastre um usuario e vincule-o na tabela `profiles`.
6. Para operacao real, configure Storage buckets para logos, anexos de pacientes e fotos de curativos.

## Identidade da clinica

Cada empresa possui `company_settings` com:

- `logo_url`
- `primary_color`
- `secondary_color`
- `accent_color`
- dados comerciais

No frontend, essas cores alimentam variaveis CSS e mudam o visual do sistema sem alterar codigo.

## IA

O servico `src/services/aiReferralReportService.ts` monta o contexto clinico e hoje retorna um mock profissional. A integracao real deve substituir o trecho indicado no servico por uma chamada segura em backend/serverless function, evitando expor chaves privadas no frontend.

## Build e producao

```bash
npm run lint
npm run build
```

Para publicar em producao:

1. Execute a migration do Supabase.
2. Configure as variaveis de ambiente no provedor de deploy.
3. Defina as URLs permitidas no Supabase Auth.
4. Crie buckets privados/publicos conforme necessidade: logos, anexos de pacientes e fotos de curativos.
5. Mantenha qualquer chave secreta de IA em uma Function ou backend, nunca em `VITE_*`.

## Mobile

A regra de negocio fica em `src/services`, os tipos em `src/types`, e os componentes foram criados com layout responsivo. Isso facilita reutilizar dominio, validacoes e contratos em um futuro app React Native/Expo.
