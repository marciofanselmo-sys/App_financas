-- ============================================================================
-- Demonstração: eventos da família e datas sempre no mês atual
-- ============================================================================
-- Rodar no SQL Editor do Supabase DEPOIS de migration_demo.sql. Idempotente.
--
-- 1. Dois eventos na conta da demo, marcando lançamentos que já existem:
--    "Férias em família" (mês com mais gasto em Viagens/Passeios) e
--    "Aniversário da Beatriz" (mês com mais gasto em Presentes). É o que a
--    parada "Quanto custou cada viagem" do tour mostra.
-- 2. demo_alinhar(): mantém os dados da demo no mês atual. Os dados vão até
--    out/2026; virou o mês, todas as datas da conta da demo andam o mesmo
--    número de meses (lançamentos, planejamento, metas, posição dos
--    investimentos). Chamada pelo próprio /demo a cada entrada — só mexe
--    quando o mês virou, e lembra até onde já andou (tabela demo_estado).
-- ============================================================================

-- 1 ───────────────────────────────────────────────────────────────────────────
do $$
declare
  demo uuid;
  mes  date;
  ev   uuid;
begin
  select id into demo from auth.users where lower(email) = 'demo@noblifinance.com.br';
  if demo is null then raise exception 'Rode antes o migration_demo.sql (conta demo@noblifinance.com.br)'; end if;

  -- Férias: o mês com mais gasto em Viagens + Passeios.
  select date_trunc('month', t.date)::date into mes
    from transactions t
   where t.user_id = demo and t.type = 'despesa' and t.category in ('Viagens', 'Passeios')
   group by 1 order by sum(t.amount) desc limit 1;
  if mes is not null then
    insert into events (user_id, name, color, closed) values (demo, 'Férias em família', '#0ea5e9', true)
    on conflict (user_id, name) do update set color = excluded.color
    returning id into ev;
    update transactions set event_id = ev
     where user_id = demo and type = 'despesa'
       and date >= mes and date < (mes + interval '1 month')
       and category in ('Viagens', 'Passeios', 'Restaurante', 'Estacionamento');
  end if;

  -- Aniversário: o mês com mais gasto em Presentes.
  mes := null;
  select date_trunc('month', t.date)::date into mes
    from transactions t
   where t.user_id = demo and t.type = 'despesa' and t.category = 'Presentes'
   group by 1 order by sum(t.amount) desc limit 1;
  if mes is not null then
    insert into events (user_id, name, color, closed) values (demo, 'Aniversário da Beatriz', '#ec4899', true)
    on conflict (user_id, name) do update set color = excluded.color
    returning id into ev;
    update transactions set event_id = ev
     where user_id = demo and type = 'despesa' and event_id is null
       and date >= mes and date < (mes + interval '1 month')
       and category in ('Presentes', 'Padaria', 'Roupas');
  end if;
end $$;

-- 2 ───────────────────────────────────────────────────────────────────────────
create table if not exists public.demo_estado (
  id        int primary key default 1 check (id = 1),
  mes_dados text not null            -- 'AAAA-MM' em que os dados da demo estão
);
alter table public.demo_estado enable row level security;  -- sem políticas: só o servidor
insert into public.demo_estado (id, mes_dados) values (1, '2026-10') on conflict (id) do nothing;

-- Data ISO (AAAA-MM-DD ou com hora) + n meses, devolvida no mesmo formato.
create or replace function public.demo_iso_mais(txt text, n int)
returns text language sql immutable as $$
  select case
    when txt is null or txt = '' then txt
    when length(txt) = 10 then to_char((txt::date + make_interval(months => n))::date, 'YYYY-MM-DD')
    else to_char((txt::timestamptz + make_interval(months => n)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  end
$$;

create or replace function public.demo_alinhar()
returns int
language plpgsql security definer
set search_path = public, auth
as $$
declare
  demo  uuid;
  atual text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
  salvo text;
  n     int;
  c     record;
begin
  select id into demo from auth.users where lower(email) = 'demo@noblifinance.com.br';
  if demo is null then return 0; end if;
  select mes_dados into salvo from demo_estado where id = 1 for update;
  n := (substr(atual, 1, 4)::int * 12 + substr(atual, 6, 2)::int)
     - (substr(salvo, 1, 4)::int * 12 + substr(salvo, 6, 2)::int);
  if n <= 0 then return 0; end if;

  -- Toda coluna de data das tabelas do usuário (menos quando a linha foi criada).
  for c in
    select col.table_name as t, col.column_name as cn, col.data_type as dt
      from information_schema.columns col
      join pg_class pc on pc.relname = col.table_name and pc.relkind = 'r'
      join pg_namespace ns on ns.oid = pc.relnamespace and ns.nspname = 'public'
     where col.table_schema = 'public'
       and col.data_type in ('date', 'timestamp with time zone', 'timestamp without time zone')
       and col.column_name not in ('created_at', 'updated_at')
       and col.table_name not in ('product_events', 'app_errors', 'admin_page_views')
       and exists (select 1 from information_schema.columns u
                    where u.table_schema = 'public' and u.table_name = col.table_name and u.column_name = 'user_id')
  loop
    if c.dt = 'date' then
      execute format('update public.%I set %I = (%I + make_interval(months => $1))::date where user_id = $2 and %I is not null', c.t, c.cn, c.cn, c.cn) using n, demo;
    else
      execute format('update public.%I set %I = %I + make_interval(months => $1) where user_id = $2 and %I is not null', c.t, c.cn, c.cn, c.cn) using n, demo;
    end if;
  end loop;

  -- Planejamento (mês/ano em números). Em dois passos por causa do unique.
  update budget_plans set year = year + 50 where user_id = demo;
  update budget_plans b
     set month = extract(month from x.d)::int, year = extract(year from x.d)::int
    from (select id, make_date(year - 50, month, 1) + make_interval(months => n) as d from budget_plans where user_id = demo) x
   where b.id = x.id;

  -- Metas: prazo 'AAAA-MM' e data do último valor puxado.
  update goals set deadline = to_char(to_date(deadline || '-01', 'YYYY-MM-DD') + make_interval(months => n), 'YYYY-MM')
   where user_id = demo and deadline ~ '^\d{4}-\d{2}$';
  update goals set last_import = jsonb_set(last_import, '{importedAt}', to_jsonb(demo_iso_mais(last_import->>'importedAt', n)))
   where user_id = demo and last_import ? 'importedAt';

  -- Investimentos: data da posição, histórico e datas dos rendimentos.
  update transaction_boards set last_position_import =
    jsonb_set(jsonb_set(jsonb_set(last_position_import,
      '{importedAt}', to_jsonb(demo_iso_mais(last_position_import->>'importedAt', n))),
      '{history}', coalesce((select jsonb_agg(case when h ? 'importedAt' then jsonb_set(h, '{importedAt}', to_jsonb(demo_iso_mais(h->>'importedAt', n))) else h end)
                             from jsonb_array_elements(coalesce(last_position_import->'history', '[]'::jsonb)) h), '[]'::jsonb)),
      '{proventos}', coalesce((select jsonb_agg(case when p ? 'paymentDate' then jsonb_set(p, '{paymentDate}', to_jsonb(demo_iso_mais(p->>'paymentDate', n))) else p end)
                               from jsonb_array_elements(coalesce(last_position_import->'proventos', '[]'::jsonb)) p), '[]'::jsonb))
   where user_id = demo and last_position_import ? 'importedAt';

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'transaction_boards' and column_name = 'position_import_history') then
    execute $q$
      update transaction_boards set position_import_history = (
        select coalesce(jsonb_agg(case when h ? 'importedAt' then jsonb_set(h, '{importedAt}', to_jsonb(demo_iso_mais(h->>'importedAt', $1))) else h end), '[]'::jsonb)
          from jsonb_array_elements(position_import_history) h)
       where user_id = $2 and jsonb_typeof(position_import_history) = 'array'
    $q$ using n, demo;
  end if;

  update demo_estado set mes_dados = atual where id = 1;
  return n;
end $$;

revoke all on function public.demo_alinhar() from public, anon, authenticated;
grant execute on function public.demo_alinhar() to service_role;
