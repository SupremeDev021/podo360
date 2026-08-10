# Rotacao do token Cloudflare

Data: 09/08/2026

O token Cloudflare compartilhado anteriormente deve ser considerado
comprometido. Ele nao foi reutilizado nesta rodada e nao foi gravado em codigo,
documentacao, bundle ou workflow.

A integracao OAuth disponivel administra DNS e Pages, mas nao tokens pessoais.
A tentativa da API retornou `9109 Unauthorized`. Portanto, permanece uma acao
manual obrigatoria: revogar imediatamente o token antigo em **Cloudflare > My
Profile > API Tokens**. Nao e necessario nem permitido enviar o valor do token
para o chat.

Enquanto a revogacao nao for confirmada, existe risco residual de uso indevido
das permissoes concedidas ao token antigo. Operacoes atuais devem continuar por
OAuth ou secrets protegidos com privilegio minimo.
