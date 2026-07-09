-- Cria a tabela de Metas Financeiras (aba /goals) — mesma lacuna de
-- budget_plans: o CREATE TABLE nunca foi salvo em nenhum migration_*.sql. Num
-- Supabase novo, a aba de Metas falha silenciosamente (tabela não existe).
create table if not exists goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null default 'personalizada'
    check (type in ('reserva', 'investimento', 'carro', 'viagem', 'divida', 'imovel', 'personalizada')),
  target_amount numeric not null default 0,
  current_amount numeric not null default 0,
  deadline text, -- 'YYYY-MM'
  color text not null default '#3b82f6',
  last_import jsonb,
  created_at timestamptz default now() not null
);

-- RLS
alter table goals enable row level security;

drop policy if exists "Users can view own goals" on goals;
drop policy if exists "Users can insert own goals" on goals;
drop policy if exists "Users can update own goals" on goals;
drop policy if exists "Users can delete own goals" on goals;

create policy "Users can view own goals"
  on goals for select using (auth.uid() = user_id);
create policy "Users can insert own goals"
  on goals for insert with check (auth.uid() = user_id);
create policy "Users can update own goals"
  on goals for update using (auth.uid() = user_id);
create policy "Users can delete own goals"
  on goals for delete using (auth.uid() = user_id);

-- Índice
create index if not exists goals_user_id_idx on goals(user_id);
