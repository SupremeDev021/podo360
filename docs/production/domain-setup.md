# Configuracao de Dominio - Podo360 Clinica

Data: 13/07/2026

Dominio planejado:

- `podo360.supremetechdev.com`

## Estado Atual

- O build local do Podo360 Clinica passou.
- O deploy atual em GitHub Pages deve ser preservado ate o cutover.
- Nenhum arquivo `CNAME` foi adicionado nesta rodada para nao alterar o dominio publicado antes da preparacao de DNS.

## DNS

Criar um registro CNAME:

- Nome: `podo360`
- Destino: `supremedev021.github.io`

Depois que o DNS propagar, configurar o dominio customizado nas configuracoes de Pages do repositorio `SupremeDev021/podo360`.

## Build e Router

Para dominio customizado na raiz, o build deve usar base `/`.

Se o workflow atual estiver usando base de subpasta do GitHub Pages, ajustar apenas no momento do cutover. Antes disso, manter o deploy atual para nao quebrar a URL existente.

## Supabase Auth

Adicionar em Authentication > URL Configuration:

- Site URL: `https://podo360.supremetechdev.com`
- Redirect URL: `https://podo360.supremetechdev.com/*`

Manter durante a transicao:

- URLs atuais do GitHub Pages.
- `http://localhost:5173/*` para desenvolvimento local.

## Checklist Antes do Cutover

- Build de producao aprovado.
- Login real aprovado no dominio final.
- Logout e refresh aprovados.
- Rotas protegidas aprovadas.
- Upload/Storage aprovado.
- Relatorios/PDF aprovados.
- Console sem erro critico.
- Nenhuma credencial versionada.
