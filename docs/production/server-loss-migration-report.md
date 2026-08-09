# Migracao apos perda do servidor

Data: 09/08/2026

## Incidente

O servidor dos frontends e o Cloudflare Tunnel deixou de existir. Os dominios
da Clinica e do Admin passaram a responder `530` porque continuavam ligados ao
Tunnel sem origem.

## Migracao concluida

- Clinica: GitHub Pages via Actions.
- Admin: GitHub Pages via Actions.
- Cadastro Cliente: Cloudflare Pages por Direct Upload autenticado via OAuth.
- Dados, Auth, RLS, RPCs e Storage: Supabase oficial.
- DNS da Clinica e Admin: CNAME DNS only para `supremedev021.github.io`.
- DNS do Cadastro: CNAME proxied para `cadastro-cliente.pages.dev`.
- HTTPS: ativo nos tres dominios.
- Healthcheck: Clinica, Admin, Cadastro, Auth e PostgREST obrigatorios.

## Correcao adicional

O GitHub Pages estava em modo legado e chegou a publicar o `index.html` de
desenvolvimento. Os dois repositorios foram alterados para
`build_type=workflow` e os artefatos compilados foram republicados.

## Dependencias locais

Nao existe dependencia local no runtime de producao. Referencias a localhost em
arquivos de desenvolvimento e testes nao sao endpoints de producao.
