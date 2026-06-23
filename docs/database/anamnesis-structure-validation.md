# Validação da Estrutura da Anamnese

## Objetivo

Registrar a análise técnica dos ajustes finais da Anamnese, Abertura de atendimento e Agenda Clínica sem aplicar alterações no banco de produção.

## Estrutura atual

Os módulos da Anamnese continuam salvos no registro de anamnese por meio de `formData`, preservando compatibilidade com fichas antigas e evitando migração obrigatória nesta etapa.

## Novos campos lógicos da Anamnese

- `identification_evaluation_type`: agora aceita também `Retorno`.
- `health_history`: inclui Histórico de Câncer (CA) e Doença Pulmonar Obstrutiva Crônica (DPOC).
- `surgery_history` e `surgery_description`: registram cirurgia e descrição.
- `changes`: passa a representar Avaliação Podal.
- `skin_exam`: permanece como campo legado e agora aparece dentro de Avaliação Podal.
- `edema_present`: indica Sim/Não para edema.
- `vibration_sensitivity_right`, `vibration_sensitivity_left`, `thermal_sensitivity_right`, `thermal_sensitivity_left`: separam sensibilidade por pé.
- `block_14.right_foot.onicocriptosis_grade` e `block_14.left_foot.onicocriptosis_grade`: registram grau da Onicocriptose.
- `block_15`: foi reorganizado para checklist de Procedimento, com campos livres para brocas, lixa e gramatura.
- `treatment_indication`, `lasertherapy_joules`, `led_joules`, `high_frequency_minutes`, `electrocautery_minutes`: registram Indicação de tratamento.
- `home_care_guidance`: registra Orientações Home Care.
- `patient_returned`: registra se o paciente retornou.

## Campos removidos da interface

- Abertura de atendimento: Queixa principal inicial, Motivo da abertura do BA e Prioridade.
- Agenda Clínica: Tipo de atendimento, Queixa/resumo inicial, WhatsApp separado, Data de Nascimento e Convênio/Particular por padrão.
- Evolução por Imagem: Descrição da imagem e Observação comparativa.
- Retorno: Necessita retorno? e Prioridade do retorno.
- Anamnese: módulo separado Pele e módulo Evolução e observações finais.

## Compatibilidade com dados antigos

- `skin_exam` foi mantido e exibido dentro de Avaliação Podal.
- `changes` foi mantido e ampliado com novas opções.
- `block_14` continua armazenando Diagnóstico Ungueal por pé.
- `block_15` aceita dados antigos de procedimento, lixa, cuidados e brocas e os converte para a nova visualização quando possível.
- Campos antigos não foram apagados do banco.

## Convênio / Particular por clínica

Foi preparada a flag lógica `enableInsuranceType` no tipo `Company` e na tela de configurações da clínica.

Nesta etapa, a persistência em Supabase não foi forçada para evitar erro caso a coluna ainda não exista em produção.

Migration futura recomendada:

```sql
alter table companies
add column if not exists enable_insurance_type boolean not null default false;
```

## Riscos antes de produção

- Confirmar se `companies.enable_insurance_type` será coluna dedicada ou parte de um JSON de configurações da clínica.
- Validar se os relatórios legados que consomem `formData` fora do frontend precisam conhecer os novos campos.
- Validar RLS das tabelas de anamnese, atendimentos, imagens e sensibilidade por `company_id`.
- Confirmar se constraints de BA aberto por paciente serão aplicadas no banco em fase posterior.

## O que não foi aplicado

- Nenhuma migration foi aplicada em produção.
- Nenhum SQL foi executado no banco real.
- Nenhum dado antigo foi apagado.
- Nenhuma chave ou credencial foi adicionada.

