-- 1. Criar tabela de categorias
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('receita', 'despesa', 'ambos')),
  color text not null default '#6366f1',
  created_at timestamptz default now() not null,
  unique (user_id, name)
);

-- 2. RLS
alter table categories enable row level security;

drop policy if exists "Users can view own categories" on categories;
drop policy if exists "Users can insert own categories" on categories;
drop policy if exists "Users can update own categories" on categories;
drop policy if exists "Users can delete own categories" on categories;

create policy "Users can view own categories"
  on categories for select using (auth.uid() = user_id);
create policy "Users can insert own categories"
  on categories for insert with check (auth.uid() = user_id);
create policy "Users can update own categories"
  on categories for update using (auth.uid() = user_id);
create policy "Users can delete own categories"
  on categories for delete using (auth.uid() = user_id);

-- 3. Remover o CHECK constraint fixo de transactions
alter table transactions drop constraint if exists transactions_category_check;

-- 4. Índice
create index if not exists categories_user_id_idx on categories(user_id);
