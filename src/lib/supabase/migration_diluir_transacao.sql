-- Diluir transação (nota fiscal) — 11/10/2026
--
-- Uma compra (ex.: R$ 57,94 no mercado) vira itens, cada um com a sua
-- categoria. Os itens são transações comuns (diluted_from_id aponta para a
-- original) e somam em saldo, gastos e relatórios. A original continua no
-- banco — a importação compara data|valor|descrição para não duplicar o
-- extrato —, mas passa a valer 0 e guarda o valor em diluted_amount. Assim
-- nenhuma soma do app conta a compra duas vezes, sem precisar mudar cada tela.
--
-- Idempotente: pode rodar de novo.

alter table public.transactions add column if not exists diluted_amount numeric(12, 2);
alter table public.transactions add column if not exists diluted_from_id uuid
  references public.transactions(id) on delete cascade;
create index if not exists transactions_diluted_from_idx
  on public.transactions (diluted_from_id) where diluted_from_id is not null;

-- O valor 0 só é aceito na transação diluída (com diluted_amount).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.transactions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%amount > %'
      and conname <> 'transactions_amount_diluida_check'
  loop
    execute format('alter table public.transactions drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.transactions drop constraint if exists transactions_amount_diluida_check;
alter table public.transactions add constraint transactions_amount_diluida_check
  check (amount > 0 or (amount = 0 and diluted_amount is not null));

-- Grava (ou regrava) os itens de uma vez só: ou tudo, ou nada.
-- p_itens: [{ "description": "...", "amount": 25.05, "category": "..." }, ...]
create or replace function public.diluir_transacao(p_id uuid, p_itens jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  t public.transactions;
  total numeric(12, 2);
  soma numeric(12, 2);
begin
  select * into t from public.transactions
   where id = p_id and user_id = auth.uid()
   for update;
  if not found then raise exception 'Transação não encontrada.'; end if;
  if t.diluted_from_id is not null then raise exception 'Um item de nota não pode ser diluído.'; end if;
  if t.type <> 'despesa' then raise exception 'Só despesas podem ser diluídas.'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe pelo menos um item.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_itens) i
     where coalesce(trim(i->>'description'), '') = ''
        or coalesce(trim(i->>'category'), '') = ''
        or coalesce((i->>'amount')::numeric, 0) <= 0
  ) then
    raise exception 'Todo item precisa de nome, categoria e valor maior que zero.';
  end if;

  total := coalesce(t.diluted_amount, t.amount);
  select sum(round((i->>'amount')::numeric, 2)) into soma from jsonb_array_elements(p_itens) i;
  if soma <> total then
    raise exception 'A soma dos itens (%) não fecha com a transação (%).', soma, total;
  end if;

  delete from public.transactions where diluted_from_id = p_id and user_id = auth.uid();

  insert into public.transactions
    (user_id, description, amount, date, type, category, board_id, tags, event_id, diluted_from_id)
  select auth.uid(), left(trim(i->>'description'), 200), round((i->>'amount')::numeric, 2),
         t.date, t.type, trim(i->>'category'), t.board_id, t.tags, t.event_id, p_id
    from jsonb_array_elements(p_itens) i;

  update public.transactions set amount = 0, diluted_amount = total where id = p_id;
end;
$$;

-- Desfaz: apaga os itens e devolve o valor à transação original.
create or replace function public.desfazer_diluicao(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare t public.transactions;
begin
  select * into t from public.transactions
   where id = p_id and user_id = auth.uid()
   for update;
  if not found then raise exception 'Transação não encontrada.'; end if;
  if t.diluted_amount is null then return; end if;
  delete from public.transactions where diluted_from_id = p_id and user_id = auth.uid();
  update public.transactions set amount = t.diluted_amount, diluted_amount = null where id = p_id;
end;
$$;

revoke all on function public.diluir_transacao(uuid, jsonb) from public, anon;
revoke all on function public.desfazer_diluicao(uuid) from public, anon;
grant execute on function public.diluir_transacao(uuid, jsonb) to authenticated;
grant execute on function public.desfazer_diluicao(uuid) to authenticated;
