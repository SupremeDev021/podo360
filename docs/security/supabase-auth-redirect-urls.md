# URLs de redirecionamento do Supabase Auth

Data: 09/08/2026

## Estado

A integracao disponivel acessa banco, Auth operacional e Storage, mas nao expoe
a configuracao `Authentication > URL Configuration`. Por isso, as URLs abaixo
sao requisitos esperados e **nao foram confirmadas no painel nesta rodada**.

Site URL esperado:

- `https://podo360.supremetechdev.com`

Redirect URLs esperadas:

- `https://podo360.supremetechdev.com/*`
- `https://podoadmin360.supremetechdev.com/*`
- `https://cadastro.podo360.supremetechdev.com/*`
- `https://supremedev021.github.io/podo360/*`
- `https://supremedev021.github.io/podo360-admin/*`
- `http://localhost:5173/*` somente para desenvolvimento
- `http://localhost:3000/*` somente para desenvolvimento

Pendencia operacional: conferir e, se necessario, incluir essas entradas no
painel. Producao nao deve depender de localhost, IP local, Tailscale ou Tunnel
antigo.
