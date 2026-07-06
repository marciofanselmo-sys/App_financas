-- Adiciona a meta geral de "Gastos previstos" ao planejamento mensal,
-- como referência de topo separada do detalhamento por categoria.
alter table budget_plans
  add column if not exists expenses_target numeric not null default 0;
