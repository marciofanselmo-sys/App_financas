-- Executar no SQL Editor do Supabase

-- 1. Criar tabela de regras de categorização (caso não exista)
create table if not exists categorization_rules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  keyword text not null,
  match_type text not null default 'contains'
    check (match_type in ('contains', 'starts_with', 'ends_with', 'exact')),
  category text not null,
  board_id uuid references transaction_boards(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz default now() not null
);

-- 2. Se a tabela já existia (sem match_type e board_id), adicionar as colunas
alter table categorization_rules
  add column if not exists match_type text not null default 'contains'
    check (match_type in ('contains', 'starts_with', 'ends_with', 'exact')),
  add column if not exists board_id uuid references transaction_boards(id) on delete set null;

-- 3. RLS
alter table categorization_rules enable row level security;

drop policy if exists "Users can view own rules" on categorization_rules;
drop policy if exists "Users can insert own rules" on categorization_rules;
drop policy if exists "Users can update own rules" on categorization_rules;
drop policy if exists "Users can delete own rules" on categorization_rules;

create policy "Users can view own rules"
  on categorization_rules for select using (auth.uid() = user_id);
create policy "Users can insert own rules"
  on categorization_rules for insert with check (auth.uid() = user_id);
create policy "Users can update own rules"
  on categorization_rules for update using (auth.uid() = user_id);
create policy "Users can delete own rules"
  on categorization_rules for delete using (auth.uid() = user_id);

-- 4. Índice
create index if not exists categorization_rules_user_id_idx on categorization_rules(user_id);
