# Arquitetura Multi-Repositório da Plataforma Podo360

## Visão Geral

A plataforma Podo360 será organizada em três sistemas separados, interligados por integrações controladas e com responsabilidades bem definidas:

- `podo360`: Sistema Clínica, usado pelas clínicas de podologia na operação diária.
- `podo360-landing`: Landing Page pública de vendas e captação de leads.
- `podo360-admin`: Sistema interno da Podo360 para gestão de empresas contratantes, leads, status, planos futuros e auditoria administrativa.

Essa separação evita misturar operação clínica com gestão comercial da plataforma. O sistema usado pela clínica deve continuar focado em atendimento, pacientes, BA, anamnese, prontuário, financeiro e estoque da própria clínica. A gestão global de clientes Podo360, ativação, suspensão, leads e planos deve ficar em um sistema administrativo separado.

## Fase 1 - Manter `podo360` Como Sistema Clínica

O repositório atual `podo360` deve continuar sendo o Sistema Clínica.

Responsabilidades do Sistema Clínica:

- BA.
- Atendimentos.
- Pacientes.
- ProntuárioÚnico.
- Anamnese.
- Pé 3D / Sensibilidade Monofilamento.
- Curativos.
- Imagens.
- Relatórios clínicos.
- Agenda.
- Financeiro da clínica.
- Estoque da clínica.
- Produtos.
- Administração da própria clínica.
- White Label da própria clínica.
- Gerenciamento de Atendimento.

O Sistema Clínica não deve conter gestão comercial global da plataforma Podo360.

O Dono/Admin da Clínica pode:

- Gerenciar usuários da própria clínica.
- Configurar dados da própria clínica.
- Configurar logo e cores da própria clínica.
- Ver pacientes da própria clínica.
- Gerenciar atendimentos da própria clínica.
- Gerenciar financeiro e estoque da própria clínica.

O Dono/Admin da Clínica não pode:

- Ver outras empresas.
- Ativar ou desativar empresas da plataforma.
- Gerenciar planos globais.
- Gerenciar leads da Landing Page.
- Controlar cobrança da plataforma.
- Ver lista global de clientes Podo360.

Toda regra clínica deve continuar respeitando `company_id`, permissões internas da clínica e Row Level Security no Supabase.

## Fase 2 - Criar `podo360-landing`

Criar um repositório separado:

```text
podo360-landing
```

Objetivo: construir a Landing Page institucional e comercial da Podo360.

Funcionalidades:

- Página inicial institucional.
- Apresentação da Podo360.
- Benefícios do sistema.
- Módulos do sistema.
- Demonstração visual.
- Formulário de lead.
- Botão para WhatsApp comercial.
- Botão "Solicitar demonstração".
- Botão "Entrar no sistema".
- Seção de planos futura, sem preços finais.
- FAQ.
- Rodapé institucional.

Regras:

- A Landing Page não acessa dados clínicos.
- A Landing Page não acessa empresas diretamente.
- A Landing Page não usa chave `service_role` no frontend.
- A Landing Page apenas envia leads para uma API ou Edge Function segura.
- A Landing Page pode direcionar o usuário para o login do Sistema Clínica.

## Fase 3 - Criar `podo360-admin`

Criar um repositório separado:

```text
podo360-admin
```

Objetivo: sistema interno da Podo360 para gerenciar empresas contratantes, leads, status e auditoria administrativa.

Funcionalidades iniciais:

- Login administrativo Podo360.
- Dashboard administrativo.
- Lista de leads.
- Cadastro de empresas.
- Lista de empresas.
- Ativar empresa.
- Desativar empresa.
- Suspender empresa.
- Reativar empresa.
- Alterar status da empresa.
- Vincular plano futuro.
- Histórico de alterações.
- Auditoria administrativa.

O `podo360-admin` será responsável por:

- Gerenciar empresas contratantes.
- Gerenciar status de acesso.
- Ver leads vindos da Landing Page.
- Controlar ativação e desativação.
- Preparar planos no futuro.
- Auditar alterações administrativas.

O `podo360-admin` não deve:

- Executar fluxo clínico.
- Editar prontuários clínicos.
- Realizar atendimento.
- Misturar-se com o sistema usado pela clínica.

## Fase 4 - Interligar Landing -> Admin

Interligar `podo360-landing` com `podo360-admin` por API ou Edge Function.

Fluxo esperado:

1. Visitante acessa a Landing Page.
2. Preenche formulário de interesse.
3. Landing envia dados para uma API ou Edge Function segura.
4. API grava o lead na tabela de leads.
5. Lead aparece no Sistema Admin.
6. Equipe Podo360 acompanha e converte o lead em empresa contratante, se fechar.

Dados do lead:

- Nome.
- Nome da clínica.
- Telefone.
- E-mail.
- Cidade.
- Mensagem.
- Origem.
- Status.
- Data de criação.

Regras de segurança:

- Não expor chave `service_role` no frontend.
- Validar dados recebidos.
- Aplicar rate limit, se possível.
- Evitar spam.
- Não permitir que a Landing Page consulte todos os leads.
- A Landing Page apenas cria lead.

## Fase 5 - Interligar Admin -> Clínica

Interligar `podo360-admin` com `podo360`.

Objetivo: o Sistema Clínica deve validar o status da empresa antes de liberar acesso.

Fluxo esperado:

1. Empresa é criada ou ativada no `podo360-admin`.
2. Empresa recebe um status:
   - `active`
   - `trial`
   - `inactive`
   - `suspended`
   - `cancelled`
3. Usuário da clínica tenta acessar o Sistema Clínica.
4. Sistema Clínica identifica o `company_id` do usuário.
5. Sistema Clínica consulta o status da empresa.
6. Se a empresa estiver `active` ou `trial`, o acesso é liberado.
7. Se a empresa estiver `inactive`, `suspended` ou `cancelled`, o acesso é bloqueado com mensagem amigável.

Mensagem sugerida:

> O acesso da sua clínica está temporariamente indisponível. Entre em contato com o suporte Podo360.

Regras:

- Não apagar dados de empresa suspensa ou cancelada.
- Apenas bloquear acesso.
- Não permitir acesso cruzado entre empresas.
- Não permitir que uma clínica consulte a lista global de empresas.
- Não permitir que uma clínica veja leads.
- Validar status em pontos críticos, não apenas no login.

## Fase 6 - Preparar Planos e Feature Flags

Preparar estrutura para planos e feature flags, sem definir preços finais e sem cobrança.

Os planos ainda não foram decididos. Portanto:

- Não definir valores finais.
- Não criar cobrança ainda.
- Não integrar gateway de pagamento.
- Não bloquear módulos por plano antes da definição comercial.

Entidades futuras possíveis:

`platform_plans`:

- `id`
- `name`
- `description`
- `features`
- `active`
- `created_at`
- `updated_at`

`platform_company_subscriptions`:

- `id`
- `company_id`
- `plan_id`
- `status`
- `starts_at`
- `trial_ends_at`
- `renews_at`
- `cancelled_at`
- `notes`
- `created_at`
- `updated_at`

`feature_flags`:

- `id`
- `key`
- `name`
- `description`
- `active`
- `created_at`

`company_feature_flags`:

- `id`
- `company_id`
- `feature_key`
- `enabled`
- `source`
- `created_at`
- `updated_at`

Features futuras possíveis:

- `dashboard`
- `atendimentos`
- `agenda`
- `financeiro`
- `estoque`
- `pe_3d`
- `relatorios`
- `white_label`
- `ia_relatorio`
- `gerenciamento_atendimento`
- `autoclave`

## Tabelas Globais Sugeridas

As tabelas abaixo são uma proposta arquitetural. Nenhuma migration deve ser aplicada nesta etapa.

Recomendação: manter tabelas globais em um schema separado, como `platform`, ou com prefixo `platform_`, sempre com RLS e políticas específicas.

`platform_companies`:

- `id`
- `company_name`
- `trading_name`
- `cnpj`
- `responsible_name`
- `responsible_email`
- `responsible_phone`
- `status`
- `plan_id`
- `created_at`
- `updated_at`
- `activated_at`
- `deactivated_at`
- `suspended_at`

`platform_leads`:

- `id`
- `name`
- `clinic_name`
- `email`
- `phone`
- `city`
- `source`
- `message`
- `status`
- `created_at`
- `updated_at`

`platform_company_status_logs`:

- `id`
- `company_id`
- `previous_status`
- `new_status`
- `reason`
- `changed_by`
- `created_at`

`platform_admin_users`:

- `id`
- `user_id`
- `role`
- `active`
- `created_at`
- `updated_at`

`platform_plans`:

- `id`
- `name`
- `description`
- `features`
- `active`
- `created_at`
- `updated_at`

`platform_company_subscriptions`:

- `id`
- `company_id`
- `plan_id`
- `status`
- `trial_ends_at`
- `starts_at`
- `renews_at`
- `cancelled_at`
- `notes`
- `created_at`
- `updated_at`

## Estratégia de Comunicação

A comunicação entre os sistemas deve ser feita de forma controlada:

- Landing Page -> API/Edge Function: cria leads.
- Admin -> tabelas globais: gerencia empresas, status, planos futuros e auditoria.
- Clínica -> consulta restrita: valida apenas status, plano e recursos da própria empresa.

O Sistema Clínica não deve consultar `platform_leads` nem a lista global de empresas. Quando precisar validar acesso, deve usar uma consulta com RLS forte ou uma função/RPC segura que retorne somente o status da empresa vinculada ao usuário autenticado.

## Controle de Status da Empresa

Status possíveis:

- `active`: acesso liberado.
- `trial`: acesso liberado, podendo exibir aviso discreto.
- `inactive`: acesso bloqueado.
- `suspended`: acesso bloqueado.
- `cancelled`: acesso bloqueado, sem apagar dados.

A validação deve ocorrer:

- Após autenticação.
- Ao carregar contexto da empresa.
- Antes de operações críticas.
- Em services/mutations sensíveis, quando aplicável.

O bloqueio não deve apagar dados clínicos. A empresa pode ser reativada futuramente pelo `podo360-admin`.

## Riscos e Cuidados

- Não expor chave `service_role` no frontend.
- Não deixar o sistema clínico consultar leads ou lista global de empresas.
- Não usar `user_metadata` como fonte confiável de permissão.
- Garantir RLS forte por `company_id`.
- Não apagar dados de empresa suspensa ou cancelada.
- Não misturar cobrança/plano dentro do fluxo clínico.
- Não bloquear módulos por plano antes da definição comercial.
- Não permitir que uma clínica veja dados de outra.
- Não criar dependência direta frágil entre os três frontends.
- Não deixar validação de status apenas no frontend.
- Não versionar `.env` com chaves reais.
- Não usar dados clínicos na Landing Page.
- Não permitir que o Admin Podo360 edite dados clínicos sem regra e auditoria específica.

## Próximos Passos

O próximo passo técnico mais seguro é criar este documento de arquitetura no repositório atual:

```text
docs/architecture/podo360-multi-repo-platform.md
```

Depois disso, criar os dois novos repositórios:

- `podo360-landing`
- `podo360-admin`

E só então começar a implementar cada frente separadamente.

Ordem recomendada:

1. Criar e revisar documento de arquitetura.
2. Validar arquitetura com o responsável do projeto.
3. Garantir que `podo360` continua sendo apenas Sistema Clínica.
4. Criar repositório `podo360-landing`.
5. Implementar Landing institucional.
6. Criar formulário de lead.
7. Criar repositório `podo360-admin`.
8. Implementar empresas, leads, status e auditoria.
9. Criar API/Edge Function para Landing enviar leads.
10. Fazer Sistema Clínica validar status da empresa.
11. Preparar planos e feature flags sem cobrança.

## Fora do Escopo Desta Etapa

Nesta etapa, não implementar:

- Novo repositório Landing.
- Novo repositório Admin.
- Edge Function real.
- Migrations reais.
- Integração Supabase produção.
- Cobrança.
- Pagamento.
- Bloqueio real por plano.
- Feature flags reais.
- Deploy.

Esta etapa cria apenas a base documental para orientar a separação da plataforma em múltiplos repositórios.
