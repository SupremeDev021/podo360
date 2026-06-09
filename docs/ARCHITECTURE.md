# Arquitetura Podo360

## Camadas

- `src/types`: contratos de dominio reutilizaveis em web e futuro mobile.
- `src/services`: regras de permissao, IA e repositorio Supabase.
- `src/components`: componentes visuais reutilizaveis.
- `supabase/migrations`: schema, indices, triggers e Row Level Security.

## Multiempresa

Todas as tabelas operacionais usam `company_id`. As policies usam `profiles.company_id`, `profiles.role` e funcoes auxiliares:

- `current_company_id()`
- `current_role()`
- `is_super_admin()`
- `can_access_company(company_id)`
- `has_financial_access()`
- `has_clinical_write_access()`

## White label

`company_settings` guarda nome exibido, logo e cores. No frontend, `App.tsx` aplica:

- `--color-primary`
- `--color-secondary`
- `--color-accent`

Isso permite que cada clinica personalize a experiencia sem fork do codigo.

## IA

`generateReferralReport` esta em `src/services/aiReferralReportService.ts`. Hoje opera em modo mock estruturado. Para producao, criar uma Supabase Edge Function ou backend proprio para chamar o provedor de IA, assim a chave privada nao fica no navegador.

## Mapa corporal 3D

`BodyMap3D` usa um modelo visual temporario em CSS com comportamento 3D, selecao de regioes, zoom, visualizacao frontal/lateral/posterior e historico de marcacoes. O contrato de dados ja permite trocar a camada visual por Three.js ou React Three Fiber:

- `region_key`
- `coordinates`
- `body_region`
- `body_side`
- `patient_id`
- `attendance_id`

## Mobile

O dominio nao depende de desktop. Para React Native/Expo, reutilize:

- tipos em `src/types`
- servicos em `src/services`
- schema Supabase
- regras de permissao

As telas web podem virar referencia para componentes mobile com os mesmos contratos.
