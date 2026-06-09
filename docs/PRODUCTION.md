# Producao Podo360

## Checklist de deploy

1. Instalar dependencias com `npm install`.
2. Rodar `npm run lint` e `npm run build`.
3. Criar um projeto Supabase.
4. Executar `supabase/migrations/001_initial_schema.sql` no SQL Editor.
5. Configurar Auth, URLs permitidas e redirects do dominio de producao.
6. Criar buckets para logos, anexos de pacientes e fotos de curativos.
7. Configurar variaveis de ambiente no provedor de deploy.
8. Criar um usuario Super Admin e vincular em `profiles` com role `super_admin`.
9. Criar a primeira empresa em `companies` e `company_settings`.
10. Configurar a IA em backend, Supabase Edge Function ou serverless function.

## Variaveis publicas do frontend

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=
VITE_AI_PROVIDER=mock
VITE_AI_REFERRAL_FUNCTION_URL=
```

Chaves secretas de IA ou service role do Supabase nao devem usar prefixo `VITE_` e nao devem ficar no frontend.

## Provedores indicados

- Vercel ou Netlify para o frontend Vite.
- Supabase para Auth, Postgres, RLS e Storage.
- Supabase Edge Functions, Vercel Functions ou backend proprio para IA.
