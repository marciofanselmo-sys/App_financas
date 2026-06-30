-- Adicionar coluna type em transaction_boards
alter table transaction_boards
  add column if not exists type text not null default 'ambos'
  check (type in ('entrada', 'saida', 'ambos'));
