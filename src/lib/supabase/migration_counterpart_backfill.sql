-- ============================================================================
-- BACKFILL — gera a perna dos pagamentos de fatura já importados
-- ============================================================================
-- Uma vez só, para o histórico que entrou antes de o app saber gravar destino.
-- Importações novas já geram a perna sozinhas.
--
-- O mapeamento é explícito de propósito: "que descrição paga qual conta" é a
-- única coisa que só você sabe conferir. Ajuste/estenda a lista do bloco
-- `mapa` se tiver outros cartões pagos por descrições diferentes.
--
-- Só gera onde a perna NÃO existe (índice único em counterpart_of_id + o
-- `not exists` abaixo), então rodar duas vezes não duplica crédito.
-- ============================================================================

-- ── 1) PRÉVIA — rode só isto primeiro, não altera nada ──────────────────────
with mapa(padrao, nome_destino) as (
  values ('PGTO FAT%', 'C6 Bank - Crédito')
)
select
  m.nome_destino                            as vai_creditar,
  count(*)                                  as linhas,
  round(sum(p.amount)::numeric, 2)          as total_reais,
  min(p.date)                               as de,
  max(p.date)                               as ate
from transactions p
join mapa m on p.description ilike m.padrao
join transaction_boards d on d.name = m.nome_destino and d.user_id = p.user_id
where p.is_internal
  and p.counterpart_of_id is null
  and not exists (select 1 from transactions g where g.counterpart_of_id = p.id)
group by m.nome_destino;


-- ── 2) APLICA — rode depois de conferir a prévia ────────────────────────────
-- with mapa(padrao, nome_destino) as (
--   values ('PGTO FAT%', 'C6 Bank - Crédito')
-- ),
-- pagamentos as (
--   select p.*, d.id as destino_id
--     from transactions p
--     join mapa m on p.description ilike m.padrao
--     join transaction_boards d on d.name = m.nome_destino and d.user_id = p.user_id
--    where p.is_internal
--      and p.counterpart_of_id is null
--      and not exists (select 1 from transactions g where g.counterpart_of_id = p.id)
-- ),
-- marca as (
--   update transactions t
--      set counterpart_board_id = p.destino_id
--     from pagamentos p
--    where t.id = p.id
--   returning 1
-- )
-- insert into transactions (
--   id, user_id, description, amount, date, type, is_internal,
--   category, board_id, counterpart_of_id, tags, created_at
-- )
-- select
--   gen_random_uuid(),
--   p.user_id,
--   p.description,
--   p.amount,
--   p.date,
--   case when p.type = 'receita' then 'despesa' else 'receita' end,
--   true,
--   p.category,
--   p.destino_id,
--   p.id,
--   '{}',
--   now()
-- from pagamentos p;


-- ── 3) CONFERÊNCIA — saldo dos cartões depois ───────────────────────────────
-- select b.name as conta,
--        round(sum(case when t.type = 'receita' then t.amount
--                       else -t.amount end)::numeric, 2) as saldo
--   from transaction_boards b
--   join transactions t on t.board_id = b.id
--  where b.name ilike '%crédito%' or b.name ilike '%credito%'
--  group by b.name
--  order by saldo;
