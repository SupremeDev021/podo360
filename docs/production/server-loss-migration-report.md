# Relatorio de migracao apos perda do servidor

Data: 09/08/2026

## Incidente

O servidor que hospedava os frontends e o Cloudflare Tunnel deixou de existir. Os dominios `podo360.supremetechdev.com` e `podoadmin360.supremetechdev.com` passaram a responder HTTP 530 porque a origem do tunnel ficou indisponivel.

## Dependencias encontradas

- Frontends da Clinica, Admin e Cadastro publicados no Nginx do servidor perdido.
- Cloudflare Tunnel executado nesse servidor.
- Healthcheck agendado consultando os dominios ligados ao tunnel.
- Documentacao operacional com IPs e caminhos historicos do servidor.

As referencias a localhost em `.env.example`, Playwright e documentacao de desenvolvimento nao sao dependencias de producao. Elas permanecem identificadas como desenvolvimento local.

## Migracao realizada

- Clinica: GitHub Pages confirmado como destino externo funcional.
- Admin: GitHub Pages confirmado como destino externo funcional.
- Dados, autenticacao, RPCs e Storage permanecem no projeto Supabase oficial; nenhum dado clinico dependia do disco do servidor.
- Healthcheck passou a consultar GitHub Pages, Auth e PostgREST diretamente.
- Foi adicionado `/healthcheck.json` estatico e um bloqueio de CI para endpoints locais no bundle.
- Fallbacks que mantinham Agenda e reabertura apenas em memoria foram removidos.

## Pendencia externa

Os DNS customizados ainda apontam para o tunnel perdido e precisam ser alterados no Cloudflare para GitHub Pages. Ate essa troca, usar `https://supremedev021.github.io/podo360/` e `https://supremedev021.github.io/podo360-admin/`.

O `cadastro-cliente` continua privado e o plano atual nao permite GitHub Pages para repositorio privado. E necessaria uma hospedagem externa que aceite repositorio privado ou autorizacao explicita para mudar a visibilidade.
