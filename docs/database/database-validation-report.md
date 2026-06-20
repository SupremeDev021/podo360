# Relatório de Validação do Banco de Dados Podo360

Data da revisão: 2026-06-20

## Escopo

Esta revisão analisou apenas arquivos versionados do repositório `podo360`, principalmente `supabase/migrations`. Nenhuma migration foi aplicada, nenhum SQL foi executado em produção e nenhum dado real foi alterado.

## Tabelas Analisadas

- `companies`
- `company_settings`
- `profiles`
- `patients`
- `patient_clinical_data`
- `unique_medical_records`
- `patient_company_links`
- `attendances`
- `attendance_history`
- `anamnesis_records`
- `foot_sensitivity_maps`
- `attendance_images`
- `attendance_used_products`
- `patient_body_maps`
- `appointments`
- `financial_transactions`
- `stock_products`
- `stock_movements`
- `reports`
- `ai_referral_reports`
- `attendance_audit_logs`
- `autoclave_records`
- `autoclave_record_items`
- `user_module_permissions`

## Relações Principais

- `attendances.patient_id` aponta para `patients.id`.
- `attendances.company_id` escopa o BA/atendimento por clínica.
- `attendances.unique_medical_record_id` vincula o BA ao ProntuárioÚnico.
- `anamnesis_records`, `foot_sensitivity_maps`, `attendance_images`, `attendance_used_products` e `patient_body_maps` dependem de `attendance_id`.
- `attendance_audit_logs` registra eventos de finalização/reabertura.

## RLS e Segurança

As migrations habilitam RLS nas tabelas clínicas principais. Os padrões encontrados usam `company_id`, `current_company_id()` e funções auxiliares de papel/permissão para isolar dados por clínica.

Pontos positivos:

- `attendances`, `patients`, `anamnesis_records`, `foot_sensitivity_maps`, `attendance_images` e auditoria têm RLS.
- Existem políticas de isolamento por empresa.
- Existe bloqueio por trigger para impedir escrita em atendimento finalizado nas tabelas clínicas mais sensíveis.
- `attendance_audit_logs` é escopada por empresa e controlada por perfil/permissão.

Pontos a revisar antes da produção real:

- Confirmar em ambiente Supabase que todas as funções `security definer` estão com `search_path` seguro.
- Confirmar que permissões não dependem de `user_metadata`; preferir perfil em tabela e/ou `app_metadata`.
- Validar se todas as tabelas expostas na Data API têm RLS ativo e políticas adequadas.
- Validar se roles `anon`/`authenticated` não receberam grants excessivos.

## Status de BA e Atendimento

Status em uso no frontend:

- `ba_open`
- `waiting`
- `in_progress`
- `reopened`
- `paused`
- `completed`
- `cancelled`
- `no_show`

Status abertos para regra de BA único:

- `ba_open`
- `waiting`
- `in_progress`
- `reopened`
- `paused`

Status finalizados/fechados que não devem bloquear novo BA:

- `completed`
- `cancelled`
- `no_show`

## Problema Encontrado

Não foi encontrada uma constraint/índice parcial no banco impedindo, de forma definitiva, mais de um BA aberto para o mesmo `patient_id` e `company_id`.

O frontend e o service agora validam antes de criar BA, mas uma proteção de banco será importante para produção real.

## Recomendação de Migration Futura

Não aplicar sem validação prévia.

Sugestão de índice único parcial:

```sql
create unique index concurrently if not exists attendances_one_open_ba_per_patient_company
on public.attendances(company_id, patient_id)
where status in ('ba_open', 'waiting', 'in_progress', 'reopened', 'paused')
  and finished_at is null;
```

Cuidados antes de aplicar:

- Verificar se `reopened` existe no enum `public.attendance_status` no banco real.
- Rodar consulta para detectar duplicidades abertas existentes.
- Resolver duplicidades manualmente antes de criar o índice.
- Aplicar em janela controlada.

Consulta sugerida para auditoria antes da constraint:

```sql
select company_id, patient_id, count(*) as open_count
from public.attendances
where status in ('ba_open', 'waiting', 'in_progress', 'reopened', 'paused')
  and finished_at is null
group by company_id, patient_id
having count(*) > 1;
```

## Índices Recomendados Futuramente

- Índice parcial único para BA aberto por paciente/empresa.
- Índice para busca rápida de BA aberto:

```sql
create index concurrently if not exists idx_attendances_open_by_patient_company
on public.attendances(company_id, patient_id, status)
where finished_at is null;
```

## RLS a Revisar

- Confirmar políticas de `attendances` para `insert` e `update`, especialmente recepção/profissional.
- Confirmar que usuários comuns não conseguem consultar atendimentos de outra empresa.
- Confirmar que logs de auditoria não são alteráveis por usuários comuns.
- Confirmar que tabelas de imagens/storage seguem isolamento por empresa.

## Riscos de Produção

- Sem constraint no banco, múltiplos BAs abertos podem ocorrer em corrida concorrente entre dispositivos.
- Se o status `reopened` existir no frontend mas não no enum real, fluxos de reabertura podem divergir.
- Se permissões dependessem de claims editáveis, RLS poderia ser bypassada; não usar `user_metadata` como fonte confiável.
- Triggers de bloqueio de atendimento finalizado precisam ser testados em ambiente de homologação antes do go-live.

## O Que Não Foi Aplicado

- Nenhuma migration nova.
- Nenhum índice novo.
- Nenhuma constraint nova.
- Nenhuma alteração em dados reais.
- Nenhuma alteração em RLS de produção.

## Próximos Passos

1. Validar duplicidades abertas no banco de homologação.
2. Confirmar enum `attendance_status` e status reais usados em produção.
3. Criar migration para índice parcial único.
4. Rodar testes de abertura de BA concorrente.
5. Revisar RLS com usuário de cada perfil.
6. Só então aplicar em produção com aprovação.
