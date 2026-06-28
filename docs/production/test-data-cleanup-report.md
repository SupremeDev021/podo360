# Relatorio de Limpeza de Dados Ficticios - Podo360

Data: 28/06/2026

## Escopo

Limpeza dos dados ficticios criados pela suite E2E autenticada de validacao final.

## Prefixo

Todos os pacientes criados pela suite usaram o prefixo:

`TESTE_PRODUCAO_PODO360_`

## Metodo

- Login com Usuario A por variaveis locais ignoradas pelo Git.
- Uso da chave publica/publishable do frontend, nao `service_role`.
- Delecao restrita por:
  - `company_id = d4666e95-0278-4cfb-b805-0b93b6bc4d4a`
  - `full_name like 'TESTE_PRODUCAO_PODO360_%'`
- Sem `truncate`.
- Sem delete amplo.
- Sem apagar empresas, usuarios ou profiles.

## Resultado

- Pacientes ficticios encontrados: 22.
- Pacientes ficticios removidos: 22.

As tabelas dependentes com `on delete cascade` foram limpas pelo proprio banco quando aplicavel.

## Pendencias

- `unique_medical_records` gerados pelos pacientes de teste podem permanecer caso nao estejam configurados com cascade a partir de `patients`.
- Recomenda-se uma consulta administrativa posterior para confirmar se existem PUs orfas com hash/nome associado ao prefixo de teste, antes de liberar producao real.
