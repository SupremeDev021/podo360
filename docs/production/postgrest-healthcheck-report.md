# PostgREST e healthcheck de producao

Data: 09/08/2026

## Causa da falha

O run `31332672993` do GitHub Actions mostrou HTTP 530 para Clinica e Admin e sucesso para o Auth. O codigo 530 foi devolvido pelo Cloudflare porque o tunnel/origem local deixou de existir. O workflow falhava corretamente, mas repetia o alerta a cada 15 minutos contra destinos que nao poderiam se recuperar.

## Estado do PostgREST

Uma chamada autenticada leve a `/rest/v1/profiles?select=id&limit=1` respondeu HTTP 200. O endpoint base do PostgREST tambem respondeu dentro do esperado em tres tentativas. Nao foi reproduzido estado unhealthy no servico de dados.

Nao houve alteracao de RLS, grants, functions, triggers ou schema cache nesta rodada. `NOTIFY pgrst, 'reload schema'` nao foi executado porque nao havia evidencia de cache desatualizado.

## Novo monitor

O monitor verifica:

- `https://supremedev021.github.io/podo360/healthcheck.json`;
- `https://supremedev021.github.io/podo360-admin/healthcheck.json`;
- Auth do projeto Supabase;
- PostgREST do projeto Supabase.

O Cadastro fica fora do monitor obrigatorio ate possuir hospedagem externa independente do servidor perdido.
