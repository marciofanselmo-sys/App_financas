-- ============================================================================
-- Demonstração ao vivo (botão "Ver demonstração")
-- ============================================================================
-- Rodar no SQL Editor do Supabase DEPOIS de criar o usuário
-- demo@noblifinance.com.br (cadastro normal em /auth/register). Idempotente nas
-- partes 1 e 2; a parte 3 MOVE os dados da conta de teste +versao2 (família
-- Almeida Souza) para a conta da demo — rodar uma vez só.
--
-- 1. is_demo_user(): a sessão atual é a conta da demo?
-- 2. Políticas RESTRITIVAS: a conta da demo não grava, não altera e não apaga
--    nada em nenhuma tabela com user_id (ler continua igual). É o bloqueio de
--    verdade — o da tela só mostra o convite.
-- 3. Dados da família Almeida Souza passam para a conta da demo.
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
declare
  demo   uuid;
  origem uuid;
  r      record;
begin
  select id into demo   from auth.users where lower(email) = 'demo@noblifinance.com.br';
  select id into origem from auth.users where lower(email) = 'marcio.fanselmo+versao2@gmail.com';
  if demo is null then raise exception 'Crie primeiro o usuário demo@noblifinance.com.br'; end if;
  if origem is null then raise exception 'Conta marcio.fanselmo+versao2@gmail.com não encontrada'; end if;

  -- A conta da demo nasce com poucas linhas (categorias padrão, perfil): saem,
  -- para os dados da família entrarem sem conflito.
  for r in
    select c.relname as t
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.relkind = 'r'
      and exists (select 1 from information_schema.columns col
                  where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'user_id')
    order by case c.relname when 'transactions' then 0 when 'events' then 1 else 2 end
  loop
    execute format('delete from public.%I where user_id = $1', r.t) using demo;
  end loop;

  for r in
    select c.relname as t
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.relkind = 'r'
      and exists (select 1 from information_schema.columns col
                  where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'user_id')
  loop
    execute format('update public.%I set user_id = $1 where user_id = $2', r.t) using demo, origem;
  end loop;

  -- Preferências guardadas no perfil (pilares do planejamento, categorias v2…).
  update auth.users d
     set raw_user_meta_data = coalesce(o.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', 'Família Almeida Souza'),
         email_confirmed_at = coalesce(d.email_confirmed_at, now())
    from auth.users o
   where d.id = demo and o.id = origem;
end $$;
