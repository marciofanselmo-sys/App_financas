-- ============================================================================
-- Demonstração ao vivo (botão "Ver demonstração")
-- ============================================================================
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- A demonstração usa a PRÓPRIA conta de teste da família Almeida Souza
-- (marcio.fanselmo+versao2@gmail.com): nada é copiado nem movido. Só o
-- e-mail dela passa a ser demo@noblifinance.com.br — para o Gmail pessoal não
-- aparecer para quem vê a demonstração. A senha é a da variável DEMO_PASSWORD
-- da Vercel: na primeira entrada pelo /demo o servidor a aplica sozinho.
--
-- 1. is_demo_user(): a sessão atual é a conta da demo?
-- 2. Políticas RESTRITIVAS: a conta da demo não grava, não altera e não apaga
--    nada em nenhuma tabela com user_id (ler continua igual). É o bloqueio de
--    verdade — o da tela só mostra o convite.
-- 3. A conta da família vira a conta da demo (troca o e-mail e o nome).
-- ============================================================================

-- 1 ───────────────────────────────────────────────────────────────────────────
create or replace function public.is_demo_user()
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and lower(email) = 'demo@noblifinance.com.br'
  )
$$;
grant execute on function public.is_demo_user() to authenticated, anon;

-- 2 ───────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select c.relname as t
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.relkind = 'r' and c.relrowsecurity
      and exists (select 1 from information_schema.columns col
                  where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'user_id')
  loop
    execute format('drop policy if exists demo_somente_leitura_ins on public.%I', r.t);
    execute format('drop policy if exists demo_somente_leitura_upd on public.%I', r.t);
    execute format('drop policy if exists demo_somente_leitura_del on public.%I', r.t);
    execute format('create policy demo_somente_leitura_ins on public.%I as restrictive for insert to authenticated with check (not public.is_demo_user())', r.t);
    execute format('create policy demo_somente_leitura_upd on public.%I as restrictive for update to authenticated using (not public.is_demo_user()) with check (not public.is_demo_user())', r.t);
    execute format('create policy demo_somente_leitura_del on public.%I as restrictive for delete to authenticated using (not public.is_demo_user())', r.t);
  end loop;
end $$;

-- 3 ───────────────────────────────────────────────────────────────────────────
do $$
declare conta uuid;
begin
  select id into conta from auth.users
   where lower(email) in ('marcio.fanselmo+versao2@gmail.com', 'demo@noblifinance.com.br')
   order by (lower(email) = 'demo@noblifinance.com.br') desc
   limit 1;
  if conta is null then raise exception 'Conta da família (marcio.fanselmo+versao2@gmail.com) não encontrada'; end if;
  if exists (select 1 from auth.users where lower(email) = 'demo@noblifinance.com.br' and id <> conta) then
    raise exception 'Já existe outro usuário com demo@noblifinance.com.br — apague-o em Authentication antes';
  end if;

  update auth.users
     set email = 'demo@noblifinance.com.br',
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', 'Família Almeida Souza')
   where id = conta;

  update auth.identities
     set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', 'demo@noblifinance.com.br')
   where user_id = conta and provider = 'email';
end $$;
