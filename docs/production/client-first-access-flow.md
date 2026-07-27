# Primeiro acesso do cliente

## Fluxo

1. O cliente envia a solicitacao no Cadastro Cliente.
2. Owner ou Admin analisa e converte a solicitacao no Podo360 Admin.
3. A conversao cria a clinica, empresa comercial, assinatura e limite de usuarios.
4. O Admin gera um link de uso unico para o e-mail autorizado.
5. O cliente informa nome, senha e aceite dos termos.
6. A Edge Function valida o convite e cria `auth.users` e `profiles`.
7. O cliente entra no Podo360 Clinica com `role = company_admin` e a `company_id` do convite.

O navegador nunca informa a empresa ou o papel que sera salvo.

## Backend

- Tabela: `public.client_access_invites`.
- Funcao: `client-access`, com validacao interna de token e autorizacao.
- Acoes administrativas (`generate`, `resend`, `cancel`) aceitam somente `owner` ou `admin`.
- Token aleatorio de 256 bits; o banco armazena somente SHA-256.
- O link usa `#token=`, evitando envio do token ao Nginx e aos access logs.
- Validade: 72 horas.
- Estados: `pending`, `processing`, `used`, `expired`, `cancelled`.

## Validacoes

- solicitacao `approved` ou `converted`;
- IDs aprovados iguais aos IDs do convite;
- empresa comercial `active` ou `trial`;
- assinatura `active` ou `trial`, com plano;
- e-mail autorizado;
- limite de usuarios ativos;
- e-mail ainda nao vinculado a outra conta;
- convite pendente e dentro da validade.

O estado `processing` funciona como claim atomico e impede duas conclusoes simultaneas.

## Ambiente

Frontend Clinica: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

Edge Function: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e
`CLIENT_REGISTRATION_URL=https://cadastro.podo360.supremetechdev.com`.

`SUPABASE_SERVICE_ROLE_KEY` existe somente no ambiente seguro da Edge Function.

## Validacao de 27/07/2026

- fluxo completo pela interface: aprovado;
- Auth e Profile reais: aprovados;
- login na Clinica: aprovado;
- bloqueio no Admin Global: aprovado;
- token invalido, usado, expirado e cancelado: aprovados;
- reenvio e limite: aprovados;
- adulteracao de `company_id` e `role`: ignorada pelo backend;
- dados ficticios: removidos integralmente.

