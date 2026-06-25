# Planos Comerciais e Integração Admin da Plataforma Podo360

## Objetivo

Definir a estrutura técnica para que os planos comerciais da Podo360 sejam gerenciados no repositório separado `podo360-admin` e consumidos com segurança pelo Sistema Clínica `podo360`.

O Sistema Clínica não deve gerenciar clientes globais, preços, leads ou planos comerciais da plataforma. Ele apenas consulta o status da própria clínica, o plano vinculado, features liberadas e avisos globais ativos.

## Repositórios Envolvidos

- `podo360`: Sistema Clínica usado pelas clínicas de podologia.
- `podo360-admin`: Sistema interno da Podo360 para gestão de empresas, leads, planos, status, assinaturas, feature flags, avisos e auditoria.
- `podo360-landing`: Landing comercial futura, que poderá exibir planos ativos e enviar leads para o Admin.

## Planos Comerciais Iniciais

| Plano | Mensalidade | Setup | Indicação |
| --- | ---: | ---: | --- |
| Start | R$ 197/mês | R$ 497 | Podólogo individual ou clínica pequena |
| Clinic | R$ 397/mês | R$ 997 | Clínica pequena ou em crescimento |
| Pro | R$ 697/mês | R$ 1.497 | Clínicas com equipe e gestão completa |
| Master | A partir de R$ 997/mês | A partir de R$ 2.497 | Clínicas premium, rede ou white label avançado |

## Extras Comerciais

| Extra | Valor | Tipo |
| --- | ---: | --- |
| Usuário adicional | R$ 39/mês | Mensal |
| Profissional adicional | R$ 59/mês | Mensal |
| Treinamento extra | R$ 250 | Pontual |
| Personalização de relatório/PDF | R$ 300 a R$ 800 | Projeto |
| Implantação avançada | R$ 1.500 a R$ 3.000 | Projeto |
| White label personalizado fora do Master | R$ 700 a R$ 1.500 | Projeto |

Condições comerciais:

- Setup parcelado em até 3x sem juros.
- Mensalidade recorrente.
- Contrato mínimo sugerido de 3 meses.
- Demonstração guiada antes da contratação.

## Responsabilidades do `podo360-admin`

O Admin será responsável por:

- Dashboard administrativo.
- Empresas contratantes.
- Leads.
- Planos.
- Extras.
- Assinaturas/Contratos.
- Feature Flags.
- Avisos Globais.
- Auditoria Administrativa.
- Configurações da Plataforma.

O Admin pode:

- Criar e editar planos.
- Ativar/desativar planos.
- Definir mensalidade e setup.
- Vincular plano a empresa.
- Alterar status comercial da empresa.
- Adicionar extras ao contrato.
- Criar avisos globais.
- Gerenciar feature flags e overrides.
- Registrar auditoria administrativa.

O Admin não deve:

- Executar atendimento clínico.
- Editar prontuário clínico sem regra específica e auditoria.
- Misturar operação clínica com gestão comercial da plataforma.

## Responsabilidades do Sistema Clínica `podo360`

O Sistema Clínica pode consumir:

- `company_id` da própria clínica.
- Status de acesso da própria clínica.
- Plano ativo da própria clínica.
- Features liberadas da própria clínica.
- Avisos globais ativos.

O Sistema Clínica não pode:

- Listar todas as empresas da plataforma.
- Ver leads comerciais.
- Editar preços.
- Criar ou alterar planos globais.
- Ativar/desativar outras empresas.
- Acessar dados comerciais globais.

## Estrutura Técnica Criada

Migration local criada:

```text
supabase/migrations/016_platform_plans_admin_integration.sql
```

Tabelas previstas:

- `platform_admin_users`
- `platform_plans`
- `platform_plan_extras`
- `platform_companies`
- `platform_company_subscriptions`
- `platform_company_subscription_extras`
- `platform_features`
- `platform_plan_features`
- `platform_company_feature_overrides`
- `platform_company_status_logs`
- `platform_admin_audit_logs`
- `platform_leads`
- `platform_announcements`
- `platform_announcement_companies`

View segura para o Sistema Clínica:

```text
company_platform_access
```

Essa view é criada com `security_invoker = true` e depende de RLS nas tabelas base. O Sistema Clínica consulta apenas o registro vinculado ao `current_company_id()`.

## Feature Flags

Features iniciais previstas:

- `dashboard`
- `abertura_atendimento`
- `atendimentos`
- `pacientes`
- `agenda_clinica`
- `prontuario_evolucao`
- `anamnese_completa`
- `avaliacao_sensibilidade`
- `pe_3d`
- `itb_ihb`
- `glicemia_eva`
- `diagnostico_ungueal`
- `curativo`
- `evolucao_imagem`
- `comparativo_evolucao`
- `financeiro`
- `estoque`
- `relatorios`
- `white_label`
- `gerenciamento_atendimento`
- `avisos_globais`
- `suporte_prioritario`
- `relatorio_ia`

Nesta fase, o Sistema Clínica fica preparado para ler features, mas não bloqueia módulos por plano automaticamente. Ausência de feature configurada significa comportamento liberado para evitar quebra em produção.

## Integração Admin -> Clínica

Camadas preparadas no Sistema Clínica:

- `src/services/platformAccessService.ts`
- `src/services/companyPlanService.ts`
- `src/services/featureFlagService.ts`

Comportamento:

1. O Sistema Clínica recebe o `company_id`.
2. Consulta `company_platform_access`.
3. Se a estrutura ainda não existir ou falhar, usa fallback seguro sem quebrar a tela.
4. Se status estiver bloqueado futuramente, usa mensagem amigável:

> O acesso da sua clínica está temporariamente indisponível. Entre em contato com o suporte Podo360.

## Avisos Globais

A estrutura de avisos segue o documento:

```text
docs/architecture/platform-announcements.md
```

O Admin poderá criar avisos globais ou direcionados por empresa. O Sistema Clínica apenas exibe avisos ativos no topo da interface.

## Landing Page

Futuramente, `podo360-landing` poderá:

- Exibir planos ativos.
- Exibir “sob consulta” para Master e planos personalizados.
- Enviar leads para o Admin via API/Edge Function segura.
- Direcionar para demonstração guiada.

A Landing não deve acessar dados clínicos, não deve consultar empresas e não deve usar `service_role` no frontend.

## Segurança e RLS

Regras obrigatórias:

- Não expor `service_role` no frontend.
- Não usar `user_metadata` como fonte confiável única de permissão.
- Usar RLS forte por `company_id`.
- Clínica só consulta sua própria empresa.
- Landing apenas envia lead por API/Edge Function segura.
- Admin Podo360 gerencia planos e empresas apenas com permissão de `platform_admin`.
- Não aplicar migrations em produção sem aprovação explícita.

Bootstrap administrativo:

- O primeiro registro em `platform_admin_users` deve ser criado por operação administrativa segura no banco, depois da aprovação de produção.
- Esse bootstrap não deve ser feito pelo frontend e não deve usar `service_role` exposto em navegador.
- Depois do primeiro admin ativo, o próprio `podo360-admin` poderá gerenciar outros administradores com auditoria.

## O Que Não Foi Implementado Agora

- Cobrança automática.
- Gateway de pagamento.
- Bloqueio real de módulos por plano.
- Tela visual do `podo360-admin`.
- Deploy.
- Aplicação da migration no Supabase real.

## Riscos e Cuidados

- Aplicar a migration em ambiente errado pode criar tabelas globais no projeto incorreto.
- Feature flags não devem bloquear módulos antes de validação comercial.
- Planos e valores devem ser revisados antes de exibição pública.
- O Admin precisa de autenticação forte e auditoria.
- Views devem permanecer com `security_invoker = true` ou API segura equivalente.
- Backups devem ser feitos antes de produção.

## Próximos Passos

1. Revisar esta arquitetura.
2. Revisar a migration local `016_platform_plans_admin_integration.sql`.
3. Criar telas no `podo360-admin`: Planos, Extras, Empresas, Assinaturas, Feature Flags e Avisos.
4. Criar API/Edge Function para Landing enviar leads.
5. Testar em ambiente de homologação.
6. Somente após a frase `APROVADO PRODUÇÃO SUPABASE`, aplicar no banco real.
