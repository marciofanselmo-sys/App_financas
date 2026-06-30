-- Executar no SQL Editor do Supabase

-- 1. Tabela de quadros de transações
create table if not exists transaction_boards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null default '#3b82f6',
  icon text not null default 'wallet',
  description text,
  show_on_dashboard boolean not null default false,
  created_at timestamptz default now() not null
);

alter table transaction_boards enable row level security;

drop policy if exists "Users can view own boards" on transaction_boards;
drop policy if exists "Users can insert own boards" on transaction_boards;
drop policy if exists "Users can update own boards" on transaction_boards;
drop policy if exists "Users can delete own boards" on transaction_boards;

create policy "Users can view own boards"
  on transaction_boards for select using (auth.uid() = user_id);
create policy "Users can insert own boards"
  on transaction_boards for insert with check (auth.uid() = user_id);
create policy "Users can update own boards"
  on transaction_boards for update using (auth.uid() = user_id);
create policy "Users can delete own boards"
  on transaction_boards for delete using (auth.uid() = user_id);

create index if not exists transaction_boards_user_id_idx on transaction_boards(user_id);

-- 2. Adicionar board_id e tags na tabela transactions
alter table transactions
  add column if not exists board_id uuid references transaction_boards(id) on delete set null,
  add column if not exists tags text[] default '{}';

create index if not exists transactions_board_id_idx on transactions(board_id);
