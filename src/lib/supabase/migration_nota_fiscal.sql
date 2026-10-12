-- Nota fiscal sem transação + catálogo de nomes de produtos — 11/10/2026
-- Depende de migration_diluir_transacao.sql. Idempotente: pode rodar de novo.

-- 1) Compra criada pela nota fiscal, ainda sem o lançamento do extrato.
--    Quando o extrato chega com o mesmo valor total e a mesma data, a
--    importação junta os dois (atualiza a descrição e tira a marca) em vez de
--    criar outro lançamento.
alter table public.transactions add column if not exists nota_pendente boolean not null default false;
create index if not exists transactions_nota_pendente_idx
  on public.transactions (user_id, board_id, date) where nota_pendente;

-- Cria a compra (já diluída) a partir da nota fiscal. Reaproveita
-- diluir_transacao: a compra nasce com o valor total e é diluída na hora.
create or replace function public.criar_nota_fiscal(
  p_board uuid, p_descricao text, p_data date, p_categoria text, p_itens jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  total numeric(12, 2);
  novo uuid;
begin
  if not exists (select 1 from public.transaction_boards where id = p_board and user_id = auth.uid()) then
    raise exception 'Conta não encontrada.';
  end if;
  if coalesce(trim(p_descricao), '') = '' then raise exception 'Informe a loja.'; end if;
  if coalesce(trim(p_categoria), '') = '' then raise exception 'Informe a categoria.'; end if;
  select sum(round((i->>'amount')::numeric, 2)) into total from jsonb_array_elements(p_itens) i;
  if coalesce(total, 0) <= 0 then raise exception 'A nota precisa de itens com valor.'; end if;

  insert into public.transactions (user_id, description, amount, date, type, category, board_id, nota_pendente)
  values (auth.uid(), left(trim(p_descricao), 200), total, p_data, 'despesa', trim(p_categoria), p_board, true)
  returning id into novo;

  perform public.diluir_transacao(novo, p_itens);
  return novo;
end;
$$;

revoke all on function public.criar_nota_fiscal(uuid, text, date, text, jsonb) from public, anon;
grant execute on function public.criar_nota_fiscal(uuid, text, date, text, jsonb) to authenticated;

-- 2) Catálogo de nomes de produto, aprendido com as correções dos usuários.
--    Chave: "gtin:<código de barras conferido>" ou "loja:<cnpj>:<código interno>".
--    Cada usuário tem o seu nome para cada chave; para os outros, vale o nome
--    escolhido pelo maior número de pessoas.
create table if not exists public.nf_produtos (
  chave text not null check (length(chave) between 6 and 80),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 80),
  updated_at timestamptz not null default now(),
  primary key (chave, user_id)
);
alter table public.nf_produtos enable row level security;

drop policy if exists "nf_produtos: ver os seus" on public.nf_produtos;
drop policy if exists "nf_produtos: gravar os seus" on public.nf_produtos;
drop policy if exists "nf_produtos: mudar os seus" on public.nf_produtos;
drop policy if exists "nf_produtos: apagar os seus" on public.nf_produtos;
create policy "nf_produtos: ver os seus" on public.nf_produtos for select using (auth.uid() = user_id);
create policy "nf_produtos: gravar os seus" on public.nf_produtos for insert with check (auth.uid() = user_id);
create policy "nf_produtos: mudar os seus" on public.nf_produtos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nf_produtos: apagar os seus" on public.nf_produtos for delete using (auth.uid() = user_id);

-- Nomes para as chaves pedidas: o do próprio usuário; senão o mais escolhido.
-- security definer só para contar os outros usuários — nunca devolve quem foi.
create or replace function public.nomes_nf(p_chaves text[])
returns table (chave text, nome text)
language sql
stable
security definer
set search_path = public
as $$
  with pedidas as (
    select distinct unnest(p_chaves[1:200]) as chave
  ),
  meus as (
    select p.chave, p.nome from public.nf_produtos p
    join pedidas using (chave) where p.user_id = auth.uid()
  ),
  todos as (
    select p.chave, trim(p.nome) as nome, count(*) as pessoas, max(p.updated_at) as recente
    from public.nf_produtos p join pedidas using (chave)
    group by p.chave, trim(p.nome)
  ),
  melhor as (
    select distinct on (chave) chave, nome from todos order by chave, pessoas desc, recente desc
  )
  select m.chave, m.nome from meus m
  union all
  select b.chave, b.nome from melhor b where not exists (select 1 from meus m where m.chave = b.chave)
$$;

revoke all on function public.nomes_nf(text[]) from public, anon;
grant execute on function public.nomes_nf(text[]) to authenticated;
