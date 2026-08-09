# Dominio de producao da Clinica

Data: 09/08/2026

## Estado atual

- Dominio: `https://podo360.supremetechdev.com`
- Hospedagem: GitHub Pages via GitHub Actions
- DNS: CNAME `podo360` para `supremedev021.github.io`
- Proxy Cloudflare: DNS only
- HTTPS: habilitado e obrigatorio
- Healthcheck: `/healthcheck.json`

O registro do Cloudflare Tunnel perdido foi substituido. A aplicacao nao depende
de servidor local, Nginx, Tailscale ou Tunnel.

O Pages deve permanecer com `build_type=workflow`. O modo legado de publicacao
da branch `main` serve o HTML de desenvolvimento e nao pode ser reativado.

## Contingencia

O workflow e o build preservam os caminhos relativos e o artefato `CNAME`. A
origem tecnica continua sendo o GitHub Pages do repositorio, mas o dominio
customizado e a URL oficial.

## Supabase Auth

Manter nas URLs permitidas:

- `https://podo360.supremetechdev.com/*`
- `https://podoadmin360.supremetechdev.com/*`
- `https://cadastro.podo360.supremetechdev.com/*`
- `https://supremedev021.github.io/podo360/*`
- `https://supremedev021.github.io/podo360-admin/*`
- `http://localhost:5173/*` somente para desenvolvimento
