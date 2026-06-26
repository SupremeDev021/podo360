# Criar Primeiro Usuario Podo360

Este guia explica como criar o primeiro usuario real do Podo360 sem expor senha, token ou chave `service_role` no codigo.

Nao coloque senha em migration.
Nao commite `.env`.
Nao commite `.env.local`.
Nao use `service_role` no frontend.

## Empresas ja criadas

Empresa A:

- Nome: Clinica Pe Saudavel
- Role recomendada do primeiro usuario: `company_admin`

Empresa B:

- Nome: Clinica Teste Isolamento
- Role recomendada para teste: `company_admin`

## Opcao A - Pelo Podo360 Admin

1. Abra o Admin.
2. Acesse `/admin/setup`.
3. Clique em **Abrir Supabase Auth**.
4. No painel do Supabase, crie o usuario em Authentication.
5. Copie o `user_id` criado.
6. Volte para `/admin/setup`.
7. Preencha:
   - Auth user ID
   - Nome completo
   - E-mail
   - Company ID da clinica
8. Copie o SQL gerado.
9. Execute o SQL no Supabase SQL Editor.
10. Volte para `/admin/login` ou para o sistema clinico e teste o login.

Observacao: a tela `/admin/setup` nao salva senha e nao usa `service_role` no navegador.

## Opcao B - Pelo Supabase Auth

1. Acesse o projeto Podo360 no Supabase.
2. Abra **Authentication**.
3. Clique em **Add user**.
4. Informe e-mail e senha.
5. Confirme o usuario, se necessario.
6. Copie o ID do usuario criado.
7. No SQL Editor, rode:

```sql
insert into public.profiles (
  id,
  company_id,
  full_name,
  email,
  role,
  active
)
values (
  '<auth_user_id>',
  '<company_id>',
  'Administrador da Clinica',
  '<email_do_usuario>',
  'company_admin',
  true
)
on conflict (id) do update set
  company_id = excluded.company_id,
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  active = true,
  updated_at = now();
```

Para liberar o mesmo usuario no Podo360 Admin global, somente se ele for realmente administrador da plataforma:

```sql
insert into public.platform_admin_users (user_id, role, active)
values ('<auth_user_id>', 'owner', true)
on conflict (user_id) do update set
  role = excluded.role,
  active = true,
  updated_at = now();
```

## Opcao C - Script local nao versionado

Existe um exemplo seguro em:

`scripts/setup/create-initial-user.example.ts`

Para usar:

1. Copie para:

`scripts/setup/create-initial-user.local.ts`

2. Configure as variaveis localmente, fora do Git:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
INITIAL_USER_EMAIL=
INITIAL_USER_PASSWORD=
INITIAL_USER_FULL_NAME=
INITIAL_USER_COMPANY_ID=
INITIAL_USER_ROLE=company_admin
```

3. Rode o script localmente.

O arquivo `.local.ts` esta ignorado pelo Git.

## Validacao obrigatoria depois da criacao

Depois de criar o usuario:

1. Verifique se existe registro em `auth.users`.
2. Verifique se existe registro em `profiles`.
3. Confirme se `profiles.company_id` aponta para a clinica correta.
4. Confirme se `profiles.role = 'company_admin'`.
5. Teste login real no app.
6. Teste Dashboard.
7. Teste abertura de atendimento.
8. Teste isolamento multiempresa.

## Status de producao

Enquanto os usuarios reais e o teste multiempresa autenticado nao forem concluidos, o sistema ainda nao deve receber dados clinicos reais.
