-- Guarda o último snapshot de posição da carteira (PosicaoDetalhada.xlsx)
-- importado numa conta de investimento — mesmo formato já usado em
-- goals.last_import, pra exibir a mesma organização por categoria/subcategoria.
alter table transaction_boards
  add column if not exists last_position_import jsonb;
