# Domínio de produção da Clínica

## Destino definitivo

- Domínio: `podo360.supremetechdev.com`
- Hospedagem: GitHub Pages do repositório `SupremeDev021/podo360`
- Origem DNS esperada: CNAME `podo360` para `supremedev021.github.io`
- Proxy inicial: DNS only

O build usa caminhos relativos para funcionar tanto no domínio customizado quanto no endereço de contingência `https://supremedev021.github.io/podo360/`.

## Ordem operacional

1. Remover o registro ligado ao Cloudflare Tunnel perdido.
2. Criar o CNAME em modo DNS only.
3. Confirmar que o DNS resolve para o GitHub Pages.
4. Configurar `podo360.supremetechdev.com` em Settings > Pages.
5. Aguardar o certificado e habilitar Enforce HTTPS.
6. Confirmar `/healthcheck.json`, login e fluxos clínicos.
7. Atualizar `HEALTHCHECK_CLINIC_URL` para o domínio definitivo.

Não reativar dependência de servidor local, Tailscale, Nginx local ou Tunnel.
