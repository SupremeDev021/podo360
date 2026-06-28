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

## Resultado anterior

- Pacientes ficticios encontrados: 22.
- Pacientes ficticios removidos: 22.

As tabelas dependentes com `on delete cascade` foram limpas pelo proprio banco quando aplicavel.

## Atualizacao final - 28/06/2026

Depois da rodada final de Playwright autenticado, foram criados novamente dados ficticios com o prefixo `TESTE_PRODUCAO_PODO360_`.

Limpeza executada:

- 7 atendimentos ficticios foram marcados como nao finalizados/cancelados apenas para permitir remocao segura, pois triggers impedem escrita em atendimento finalizado.
- 7 pacientes ficticios removidos.
- 7 atendimentos ficticios removidos.
- 4 registros de anamnese ficticios removidos.
- 3 logs de auditoria ficticios removidos.
- 16 registros de historico de atendimento ficticios removidos.
- 7 registros de dados clinicos ficticios removidos.
- 7 vinculos `patient_company_links` ficticios removidos.
- 7 PUs orfaos ficticios removidos: `PU-2026-000031` a `PU-2026-000037`.

Tambem foi feita uma limpeza administrativa dos residuos anteriores:

- 29 pacientes ficticios removidos.
- 26 atendimentos ficticios removidos.
- 14 registros de anamnese ficticios removidos.
- 9 logs de auditoria ficticios removidos.
- 57 registros de historico de atendimento ficticios removidos.
- 29 registros de dados clinicos ficticios removidos.
- 29 vinculos `patient_company_links` ficticios removidos.
- 29 PUs orfaos ficticios removidos: `PU-2026-000001` a `PU-2026-000030`, exceto `PU-2026-000023`, que nao estava presente no conjunto consultado.

Confirmacao final:

- `patients` com prefixo de teste: 0.
- `unique_medical_records` com nome normalizado de teste: 0.
- Objetos `storage.objects` no bucket `company-assets` com prefixo de teste: 0.

Metodo:

- Sem `truncate`.
- Sem delete amplo.
- Deletes filtrados por prefixo de teste e/ou IDs derivados de pacientes ficticios.
- Empresas, usuarios, profiles, planos e configuracoes reais preservados.

## Pendencias

Nao ficaram dados ficticios conhecidos com o prefixo `TESTE_PRODUCAO_PODO360_` nas consultas finais executadas.
