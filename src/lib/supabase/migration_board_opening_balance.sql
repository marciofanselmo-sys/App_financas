-- ============================================================================
-- transaction_boards.opening_balance — saldo anterior ao primeiro lançamento
-- ============================================================================
-- Nenhum usuário começa a usar o app no dia em que abriu a conta. O cartão já
-- tem fatura aberta de compras que ele nunca vai importar; a conta corrente já
-- tem saldo. Sem um ponto de partida, o app assume zero e o patrimônio nasce
-- errado — e o erro nunca se corrige sozinho, porque é histórico que não existe.
--
-- Caso real que motivou: 59 pagamentos de fatura do C6 foram importados, mas
-- as compras anteriores a jan/2025 não. Com as duas pernas ligadas, o cartão
-- ficou em +R$ 8.007,85 — saldo positivo num cartão de crédito, o que diria
-- que o banco deve ao usuário. O valor que falta é exatamente o saldo inicial.
--
-- Convenção de sinal, igual a qualquer lançamento:
--   conta/investimento  ->  positivo = dinheiro que você tinha
--   cartão de crédito   ->  negativo = fatura em aberto naquele momento
--
-- Default 0 = comportamento de hoje. Esta migração sozinha não muda saldo.
-- ============================================================================

alter table transaction_boards
  add column if not exists opening_balance numeric not null default 0;

comment on column transaction_boards.opening_balance is
  'Saldo da conta antes do primeiro lançamento importado. Negativo em cartão de crédito (fatura em aberto). Somado ao saldo calculado.';
