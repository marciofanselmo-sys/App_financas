-- Marca contas de investimento (corretora, previdência, etc.) — exibidas na
-- aba Investimentos em vez de Contas e Cartões.
alter table transaction_boards
  add column if not exists is_investment boolean not null default false;
