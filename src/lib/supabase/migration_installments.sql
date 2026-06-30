-- Adiciona colunas de parcelamento nas transações
alter table transactions
  add column if not exists installment_current integer,
  add column if not exists installment_total integer;
