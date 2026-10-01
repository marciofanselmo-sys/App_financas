-- ============================================================================
-- Tipo da conta (Contas e Cartões agrupada por tipo)
-- ============================================================================
-- Coluna nova e opcional. Vazia = o app deduz o tipo pelo ícone e pelo nome
-- (src/lib/board-kind.ts); ao criar ou editar uma conta, o tipo é salvo.
alter table transaction_boards
  add column if not exists kind text
    check (kind in ('corrente', 'credito', 'digital', 'poupanca', 'dinheiro', 'outro'));
