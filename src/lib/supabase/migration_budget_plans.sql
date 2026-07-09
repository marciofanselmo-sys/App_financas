-- Cria a tabela de Planejamento Mensal (aba /planning) — faltava no schema.sql
-- e em qualquer migration anterior. Um projeto Supabase novo, seguindo o setup
-- documentado (schema.sql + migration_*.sql), nunca tinha essa tabela criada:
-- toda tentativa de salvar o planejamento falhava com "relation budget_plans
-- does not exist", silenciosamente (a tela mostrava "Salvo!" mesmo assim).
-- migration_budget_plan_expenses_target.sql já pressupõe essa tabela existindo
-- (só faz "alter table"), então precisa ser executada DEPOIS desta.
create table if not exists budget_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  month int not null check (month between 1 and 12),
  year int not null check (year between 2000 and 2100),
  expected_income numeric not null default 0,
  expenses_target numeric not null default 0,
  investment_target numeric not null default 0,
  reserve_target numeric not null default 0,
  category_limits jsonb not null default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, month, year)
);

-- RLS
alter table budget_plans enable row level security;

drop policy if exists "Users can view own budget plans" on budget_plans;
drop policy if exists "Users can insert own budget plans" on budget_plans;
drop policy if exists "Users can update own budget plans" on budget_plans;
drop policy if exists "Users can delete own budget plans" on budget_plans;

create policy "Users can view own budget plans"
  on budget_plans for select using (auth.uid() = user_id);
create policy "Users can insert own budget plans"
  on budget_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own budget plans"
  on budget_plans for update using (auth.uid() = user_id);
create policy "Users can delete own budget plans"
  on budget_plans for delete using (auth.uid() = user_id);

-- Índice
create index if not exists budget_plans_user_id_idx on budget_plans(user_id);
