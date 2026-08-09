# Relatorio de incidente de producao

Data: 09/08/2026

## Causa confirmada

O servidor de origem e o Cloudflare Tunnel foram perdidos. Os dominios customizados responderam HTTP 530, enquanto GitHub Pages, Supabase Auth e PostgREST permaneceram acessiveis.

## Correcao

Clinica e Admin passam a usar os GitHub Pages existentes como origem externa. O monitor foi alterado para esses destinos e recebeu uma verificacao direta do PostgREST. Nenhum dado real foi apagado ou migrado.

## Estado

O software e os servicos de dados estao disponiveis por destinos externos. A troca dos registros DNS no Cloudflare e a hospedagem externa do Cadastro Cliente permanecem operacoes pendentes.
