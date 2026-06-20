# Avisos Globais da Plataforma Podo360

## Objetivo

Permitir que o futuro `podo360-admin` crie avisos globais para serem exibidos no topo do Sistema Clínica `podo360`, sem misturar gestão administrativa dentro do sistema clínico.

Exemplo:

> AVISO: A partir das 23:00 o sistema ficará fora do ar para uma atualização.

## Estado Atual no Sistema Clínica

O Sistema Clínica possui uma estrutura preparada:

- Componente: `SystemNoticeBanner`
- Service isolado: `platformAnnouncementsService`
- Variável opcional: `VITE_PLATFORM_ANNOUNCEMENTS_URL`

Se a variável não estiver configurada, nenhum aviso aparece. Não existe mock fixo em produção.

## Responsabilidade do podo360-admin

O Admin deverá:

- Criar avisos.
- Editar avisos.
- Ativar/desativar avisos.
- Definir data/hora de início.
- Definir data/hora de fim.
- Definir severidade.
- Definir se o aviso pode ser fechado pelo usuário.
- Registrar auditoria de criação/alteração.

## Estrutura Futura Sugerida

Tabela sugerida, não aplicada nesta etapa:

```sql
create table public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text,
  message text not null,
  severity text not null check (severity in ('info', 'warning', 'maintenance', 'critical')),
  active boolean not null default false,
  dismissible boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## API/Edge Function Recomendada

Criar uma Edge Function ou API backend que retorne apenas avisos ativos e dentro do período:

```json
{
  "announcements": [
    {
      "id": "uuid",
      "title": "Manutenção programada",
      "message": "A partir das 23:00 o sistema ficará fora do ar para uma atualização.",
      "severity": "maintenance",
      "active": true,
      "startsAt": "2026-06-20T23:00:00-03:00",
      "endsAt": "2026-06-21T01:00:00-03:00",
      "dismissible": false
    }
  ]
}
```

## Regras de Segurança

- Não expor `service_role` no frontend.
- O Sistema Clínica deve apenas consultar avisos ativos.
- O Sistema Clínica não deve criar, editar ou apagar avisos.
- O Admin deve controlar acesso por perfil administrativo da Podo360.
- Aplicar rate limit/cache na API para evitar carga desnecessária.
- Não incluir dados clínicos em avisos globais.

## Comportamento no Sistema Clínica

- Sem endpoint configurado: não exibe nada.
- Endpoint indisponível: falha silenciosa e não quebra layout.
- Aviso ativo: exibe banner responsivo no topo do conteúdo.
- Aviso fora do período: não exibe.
- Severidades visuais:
  - `info`
  - `warning`
  - `maintenance`
  - `critical`

## Variável de Ambiente

```env
VITE_PLATFORM_ANNOUNCEMENTS_URL=
```

Deixar vazia até a API/Edge Function estar aprovada.

## O Que Não Foi Implementado Ainda

- Tabela real no Supabase.
- Migration real.
- Tela no `podo360-admin`.
- Edge Function real.
- Integração com Supabase produção.

## Próximos Passos

1. Criar tela de avisos no `podo360-admin`.
2. Criar tabela/Edge Function em homologação.
3. Validar RLS e permissões administrativas.
4. Configurar `VITE_PLATFORM_ANNOUNCEMENTS_URL` no Sistema Clínica.
5. Testar mobile/tablet e falhas de rede.
6. Só depois liberar em produção.
