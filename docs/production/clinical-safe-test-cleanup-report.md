# Relatorio de cleanup do teste clinico seguro

Data: 09/08/2026

## Protecoes

- `TEST_RUN_ID` deve obedecer a expressao
  `^TESTE_CLINICO_FINAL_SEGURO_[0-9]{8}_[0-9]{6}_[0-9a-f]{8}$`.
- A RPC exige usuario autenticado, ativo, da empresa atual e papel
  `company_admin` ou `super_admin`.
- O paciente deve ter sido criado pelo proprio usuario, conter o prefixo, ter no
  maximo 24 horas e pertencer a empresa atual.
- A rotina recusa mais de quatro pacientes e nunca usa `truncate` ou delete sem
  IDs controlados.
- Objetos do bucket privado `clinical-images` sao removidos pela API do Storage
  antes dos registros relacionais.

## Ordem de limpeza

1. Localizar paciente pelo nome e BA por `opened_by` + `initial_notes`.
2. Reunir e remover caminhos exatos de `attendance_images` no Storage.
3. Remover somente os BAs UUID marcados pela rodada.
4. Executar `cleanup_safe_clinical_test_run` para paciente, vinculos e PU orfao.
5. Confirmar zero em pacientes, BAs, vinculos, anamneses, imagens e auditoria.
6. Confirmar ausencia de cada caminho removido no Storage.

## Evidencia final

Rodada `TESTE_CLINICO_FINAL_SEGURO_20260809_235557_8d4ed693`: cleanup confirmado
pelo teste. A conferencia posterior, autenticada separadamente nas empresas A e
B, retornou zero para pacientes, BAs, imagens e logs com o prefixo seguro.
Nenhum dado ficticio clinico permaneceu.
