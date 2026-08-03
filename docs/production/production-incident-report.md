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

## Atualizacao - 02/08/2026

Uma nova amostra externa confirmou Clinica e Admin respondendo HTTP 200. Houve picos isolados acima de 3 segundos, enquanto as demais respostas ficaram abaixo de 400 ms. O servico de autenticacao respondeu rapidamente; banco sem consultas bloqueadas, sem consultas longas e com cache hit de tabelas e indices em 100%. Nao foi encontrada evidencia de indisponibilidade do banco nesta rodada.

Inicialmente o SSH em `192.168.1.94:22` recusou a chave disponivel. Uma chave Ed25519 dedicada foi instalada e permitiu ler os logs, criar backup e publicar o bundle. A causa historica comprovada da queda permanece o ponto unico de origem no servidor e na internet locais.

O healthcheck foi integrado a branch `main` pelo PR #27 e roda no GitHub Actions a cada 15 minutos, com tres tentativas e limite de cinco segundos. Clinica, Admin e autenticacao sao obrigatorios. O Cadastro e opcional enquanto seu DNS nao estiver publicado e pode ser incluido com `HEALTHCHECK_INCLUDE_CADASTRO=true`.

## Publicacao corretiva - 02/08/2026

O acesso SSH foi restabelecido e o build corrigido foi publicado no volume da Clinica. O Nginx do container passou em `nginx -t`, o fallback SPA respondeu HTTP 200 e o dominio confirmou o novo asset. Vinte requisicoes publicas consecutivas responderam HTTP 200; em uma amostra adicional de dez chamadas, a latencia ficou entre 148 e 1.336 ms, com media de 364,6 ms. Nao houve novo erro no proxy ou no Cloudflare Tunnel apos a correcao de permissoes do deploy.

Os logs do `cloudflared 2026.3.0` mostraram timeouts de DNS e perda pontual de conexao QUIC. Um candidato `2026.7.3` foi iniciado em paralelo com rede do host e protocolo HTTP/2; ele registrou quatro conexoes, aprovou os pre-checks de DNS, UDP, TCP e API e foi promovido sem queda. O container antigo permanece parado como rollback. O healthcheck externo que antes havia falhado para o Admin passou em 12 segundos depois da troca. A origem local ainda e ponto unico de falha; monitoramento reduz o tempo de deteccao, mas nao substitui redundancia de energia, internet e hospedagem.
