# Fluxo de Convite de Usuarios - Podo360 Clinica

Data: 14/07/2026

## Objetivo

Garantir que usuarios criados pela propria clinica recebam convite seguro, sem senha em codigo e sem links de producao apontando para `localhost`.

## Correcao Aplicada

- A Edge Function `admin-create-company-user` passou a informar explicitamente o `redirectTo` em convites e redefinicoes de senha.
- O redirect final de producao usado pela funcao e:
  - `https://podo360.supremetechdev.com/`
- URLs locais so sao aceitas pela funcao se `ALLOW_LOCAL_AUTH_REDIRECTS=true`.
- A tela de login passou a traduzir links expirados ou invalidos para mensagem amigavel:
  - "Este link expirou ou nao e mais valido. Solicite um novo convite ao administrador da clinica."

## Configuracao Necessaria no Painel Auth

Em Authentication > URL Configuration, manter:

- Site URL: `https://podo360.supremetechdev.com`
- Redirect URLs:
  - `https://podo360.supremetechdev.com/*`
  - `https://podoadmin360.supremetechdev.com/*`
  - `https://supremedev021.github.io/podo360/*`
  - `https://supremedev021.github.io/podo360-admin/*`
  - `http://localhost:5173/*` apenas para desenvolvimento

## Validacoes

- Typecheck do Podo360 Clinica: aprovado.
- Build do Podo360 Clinica: aprovado.
- Lint do Podo360 Clinica: aprovado.
- Edge Function `admin-create-company-user`: publicada no projeto oficial.

## Pendencia Operacional

Reenviar convite para usuarios que receberam link antigo com `localhost`, pois links antigos continuam invalidos/expirados.
