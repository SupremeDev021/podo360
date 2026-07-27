# Relatorio de Incidente de Producao

Data: 27/07/2026

## Sintomas

- Link da Clinica indisponivel ou lento em momentos pontuais.
- Falha generica durante abertura de BA.

## Infraestrutura

O dominio `https://podo360.supremetechdev.com/` usa Cloudflare Tunnel ate um servidor Ubuntu local.
O Nginx Proxy Manager encaminha para o container `podo360-clinic-web`.

Evidencias coletadas:

- Servidor com carga baixa, memoria disponivel e disco em 39%.
- Containers Clinica, Admin, Cadastro, proxy e tunnel ativos.
- Nginx e configuracao SPA validos, com `try_files $uri $uri/ /index.html`.
- Nenhum erro 5xx atual no log do proxy da Clinica.
- Vinte requisicoes consecutivas ao dominio da Clinica responderam HTTP 200.
- O servidor encerrou abruptamente em 24/07/2026 as 19:35 UTC e voltou as 20:01 UTC.
- Nao houve sequencia normal de shutdown no journal anterior.
- O Docker registrou timeouts pontuais de DNS externo.
- Cloudflare Tunnel estava ativo, sem restart, mas dependente do servidor e da internet local.

## Causa da indisponibilidade

A indisponibilidade comprovada ocorreu porque a origem esta hospedada no servidor local e o servidor sofreu reboot/queda abrupta. Durante aproximadamente 26 minutos, Nginx, containers e Cloudflare Tunnel ficaram indisponiveis. O software reiniciou automaticamente depois do boot porque os containers possuem politica de restart.

Essa arquitetura continua dependente de energia e internet locais. Para disponibilidade elevada, recomenda-se:

- nobreak/UPS no servidor, roteador e equipamento da operadora;
- link de internet redundante;
- monitoramento externo com alerta;
- hospedagem redundante ou origem em datacenter para eliminar ponto unico local.

## Aplicacao

O fluxo de BA tambem possuia risco de concorrencia e de resposta perdida. A correcao esta detalhada em `ba-opening-stability-report.md`.

## Monitoramento

Foi adicionado `npm run healthcheck:production`, sem segredos, para medir Clinica, Admin, Cadastro e disponibilidade do servico de autenticacao.

Na rodada:

- Clinica: disponivel.
- Admin: disponivel.
- Cadastro: DNS ainda nao resolvido.
- Servico de autenticacao: alcancavel; HTTP 401 sem chave e aceito apenas como prova de disponibilidade.

