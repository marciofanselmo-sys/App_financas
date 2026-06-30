-- Adiciona coluna group_label na tabela transactions
alter table transactions add column if not exists group_label text;
