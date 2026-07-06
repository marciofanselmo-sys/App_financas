-- Marca regras criadas automaticamente (ao editar a categoria de uma transação)
-- para diferenciar visualmente das regras criadas manualmente em Configurações > Regras.
alter table categorization_rules
  add column if not exists auto_created boolean not null default false;
