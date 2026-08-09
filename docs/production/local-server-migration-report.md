# Inventario de dependencias locais

Data: 09/08/2026

| Item | Classificacao | Resultado |
| --- | --- | --- |
| Nginx e containers locais | Remover da producao | Substituidos por GitHub Pages para Clinica e Admin |
| Cloudflare Tunnel local | Remover da producao | Nao e mais usado pelo destino externo; DNS ainda precisa ser alterado |
| `192.168.1.94` e Tailscale | Historico operacional | Nao usados por runtime, build ou healthcheck |
| `localhost` em exemplos e Playwright | Desenvolvimento | Mantido somente em arquivos de desenvolvimento |
| Dados clinicos | Supabase Postgres/RLS | Permanecem externos ao servidor perdido |
| Imagens e logos | Supabase Storage | Permanecem externos ao servidor perdido |
| Criacao segura de usuarios | Supabase Edge Function | Permanece externa ao servidor perdido |
| Healthcheck | GitHub Actions | Alterado para endpoints externos |

O script `npm run check:production-bundle` impede que endpoints conhecidos do servidor local sejam publicados novamente.
