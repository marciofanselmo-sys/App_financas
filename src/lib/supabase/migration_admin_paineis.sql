-- ============================================================================
-- Painel /admin em abas: Erros com status, Uso por cliente, Limites
-- ============================================================================
-- Rodar no SQL Editor do Supabase. Idempotente — pode rodar de novo.
--
-- Nada aqui guarda dado financeiro de cliente. As funções só devolvem
-- contagens e tamanhos, e só para quem é admin.
-- ============================================================================

-- 1) Status dos erros ---------------------------------------------------------
-- Um registro por TIPO de erro (onde + mensagem), não por ocorrência. As
-- ocorrências continuam em app_errors e somem em 30 dias; o status fica, para
-- o painel saber que um erro "resolvido" voltou a acontecer.
create table if not exists public.app_error_status (
  fingerprint text primary key,
  status      text not null default 'novo'
    check (status in ('novo', 'analise', 'resolvido', 'ignorado')),
  note        text,
  resolved_at timestamptz,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

alter table public.app_error_status enable row level security;

drop policy if exists "admin manages error status" on public.app_error_status;
create policy "admin manages error status"
  on public.app_error_status for all
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- 2) Registro de e-mails enviados ---------------------------------------------
-- Só data, tipo e se deu certo — sem destinatário. Serve para comparar com o
-- limite do plano grátis da Resend (3.000/mês, 100/dia). Quem grava é o
-- servidor, com a chave de serviço.
create table if not exists public.email_log (
  id      bigint generated always as identity primary key,
  sent_at timestamptz not null default now(),
  kind    text,
  ok      boolean not null default true
);

create index if not exists email_log_sent_at_idx on public.email_log(sent_at desc);

alter table public.email_log enable row level security;

drop policy if exists "admin reads email log" on public.email_log;
create policy "admin reads email log"
  on public.email_log for select
  using (public.is_app_admin());

-- 3) Números que só existem nos painéis da Vercel/Supabase ---------------------
-- Tráfego e execuções não têm API no plano grátis: o admin copia o valor do
-- painel e o app guarda com a data, para a barra de limite.
create table if not exists public.admin_manual_metrics (
  key        text primary key,
  value      numeric not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_manual_metrics enable row level security;

drop policy if exists "admin manages manual metrics" on public.admin_manual_metrics;
create policy "admin manages manual metrics"
  on public.admin_manual_metrics for all
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- 4) Tamanho real do banco -----------------------------------------------------
create or replace function public.admin_db_size()
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_app_admin() then
    raise exception 'acesso restrito ao admin';
  end if;
  return pg_database_size(current_database());
end;
$$;

grant execute on function public.admin_db_size() to authenticated;

-- 5) Uso por cliente -----------------------------------------------------------
-- O Postgres não separa MB por usuário. Para cada tabela com user_id, conta as
-- linhas de cada cliente e estima os bytes como (linhas do cliente × tamanho
-- da tabela ÷ linhas da tabela). A soma fica perto do tamanho real das
-- tabelas. A linha especial '__imports' traz o total de importações feitas.
create or replace function public.admin_usage_by_user()
returns table (uid uuid, table_name text, row_count bigint, est_bytes bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  t      text;
  total  bigint;
  bytes  bigint;
begin
  if not public.is_app_admin() then
    raise exception 'acesso restrito ao admin';
  end if;

  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'user_id'
      and c.data_type = 'uuid'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format('select count(*) from public.%I', t) into total;
    if total = 0 then continue; end if;
    bytes := pg_total_relation_size(format('public.%I', t)::regclass);

    return query execute format(
      'select user_id, %L::text, count(*)::bigint, (count(*) * %s / %s)::bigint
         from public.%I where user_id is not null group by user_id',
      t, bytes, total, t);
  end loop;

  return query
    select pu.user_id, '__imports'::text, coalesce(sum(pu.count), 0)::bigint, 0::bigint
    from public.plan_usage pu
    where pu.feature = 'import'
    group by pu.user_id;
end;
$$;

grant execute on function public.admin_usage_by_user() to authenticated;

-- Faz a API do Supabase enxergar as tabelas e funções novas na hora.
notify pgrst, 'reload schema';
