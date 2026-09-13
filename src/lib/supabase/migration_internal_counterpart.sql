-- ============================================================================
-- Movimentação interna: para onde o dinheiro foi
-- ============================================================================
-- Contexto: `is_internal` diz que a linha é movimentação entre contas do
-- próprio usuário, mas não diz PARA ONDE. Sem destino, pagar a fatura debita
-- a conta corrente e não credita o cartão — o cartão acumula todas as compras
-- para sempre e o mesmo dinheiro sai duas vezes do patrimônio.
--
-- Hoje o crédito no cartão só existe se o banco exportar a linha do pagamento
-- no arquivo da fatura: o Inter exporta, o C6 não. Cada banco novo é cara ou
-- coroa. Com estas colunas o app gera a perna que falta e para de depender
-- do formato de cada banco.
--
--   counterpart_board_id : na linha do pagamento, a conta que ele quitou
--   counterpart_of_id    : na linha GERADA, o pagamento que a originou
--
-- Ambas NULL = comportamento de hoje. Esta migração sozinha não muda saldo
-- nenhum; ela só abre espaço para o app gravar o destino.
-- ============================================================================

alter table transactions
  add column if not exists counterpart_board_id uuid
    references transaction_boards(id) on delete set null;

-- A perna gerada morre junto com o pagamento que a originou: apagar o
-- pagamento sem apagar o crédito deixaria o cartão com dinheiro do nada.
alter table transactions
  add column if not exists counterpart_of_id uuid
    references transactions(id) on delete cascade;

comment on column transactions.counterpart_board_id is
  'Conta de destino de uma movimentação interna (ex: o cartão que esta linha pagou). NULL = destino desconhecido.';
comment on column transactions.counterpart_of_id is
  'Preenchida só na perna gerada pelo app: aponta para a transação de pagamento que a originou.';

-- Uma perna gerada por pagamento. Sem isto, reimportar o mesmo extrato
-- criaria um segundo crédito e inflaria o saldo do cartão.
create unique index if not exists transactions_counterpart_of_id_uniq
  on transactions (counterpart_of_id)
  where counterpart_of_id is not null;

create index if not exists transactions_counterpart_board_id_idx
  on transactions (counterpart_board_id)
  where counterpart_board_id is not null;
