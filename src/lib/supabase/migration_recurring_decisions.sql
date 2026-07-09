-- Cria a tabela de decisões de Gastos Recorrentes (confirmar/ignorar em
-- /fixos) — mesma lacuna de budget_plans e goals: o CREATE TABLE nunca foi
-- salvo em nenhum migration_*.sql. Num Supabase novo, confirmar ou ignorar um
-- gasto fixo falha silenciosamente (tabela não existe).
create table if not exists recurring_decisions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  description_key text not null,
  decision text not null check (decision in ('confirmed', 'ignored')),
  created_at timestamptz default now() not null,
  unique (user_id, description_key)
);

-- RLS
alter table recurring_decisions enable row level security;

drop policy if exists "Users can view own recurring decisions" on recurring_decisions;
drop policy if exists "Users can insert own recurring decisions" on recurring_decisions;
drop policy if exists "Users can update own recurring decisions" on recurring_decisions;
drop policy if exists "Users can delete own recurring decisions" on recurring_decisions;

create policy "Users can view own recurring decisions"
  on recurring_decisions for select using (auth.uid() = user_id);
create policy "Users can insert own recurring decisions"
  on recurring_decisions for insert with check (auth.uid() = user_id);
create policy "Users can update own recurring decisions"
  on recurring_decisions for update using (auth.uid() = user_id);
create policy "Users can delete own recurring decisions"
  on recurring_decisions for delete using (auth.uid() = user_id);

-- Índice
create index if not exists recurring_decisions_user_id_idx on recurring_decisions(user_id);
