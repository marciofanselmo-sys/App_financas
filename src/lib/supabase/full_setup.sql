-- ============================================================================
-- SETUP COMPLETO — rodar UMA VEZ, do início ao fim, num projeto Supabase novo.
-- ============================================================================
-- Substitui a necessidade de rodar schema.sql + todos os migration_*.sql um
-- por um, na ordem certa — risco real de esquecer um arquivo (já aconteceu:
-- budget_plans, goals e recurring_decisions ficaram de fora por meses).
-- Todo bloco usa "if not exists"/"if exists", então é seguro rodar de novo
-- por engano.
--
-- Se este for um projeto JÁ EXISTENTE (não use este arquivo pra evitar
-- reprocessar alterações já aplicadas manualmente) — continue usando os
-- migration_*.sql individuais pra só o que ainda falta.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 1. transactions (schema.sql)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  date date not null,
  type text not null check (type in ('receita', 'despesa')),
  category text not null check (category in (
    'Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde',
    'Educação', 'Salário', 'Freelance', 'Outros'
  )),
  created_at timestamptz default now() not null
);

alter table transactions enable row level security;

drop policy if exists "Users can view own transactions" on transactions;
drop policy if exists "Users can insert own transactions" on transactions;
drop policy if exists "Users can update own transactions" on transactions;
drop policy if exists "Users can delete own transactions" on transactions;

create policy "Users can view own transactions"
  on transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions"
  on transactions for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions"
  on transactions for update using (auth.uid() = user_id);
create policy "Users can delete own transactions"
  on transactions for delete using (auth.uid() = user_id);

create index if not exists transactions_user_id_idx on transactions(user_id);
create index if not exists transactions_date_idx on transactions(date);
create index if not exists transactions_type_idx on transactions(type);


-- ─────────────────────────────────────────────────────────────────────────
-- 2. transaction_boards + board_id/tags em transactions (migration-boards.sql)
-- ─────────────────────────────────────────────────────────────────────────
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

alter table transactions
  add column if not exists board_id uuid references transaction_boards(id) on delete set null,
  add column if not exists tags text[] default '{}';

create index if not exists transactions_board_id_idx on transactions(board_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 3. transaction_boards: type, is_investment, last_position_import
--    (migration-board-type.sql, migration_board_is_investment.sql,
--     migration_board_position_import.sql)
-- ─────────────────────────────────────────────────────────────────────────
alter table transaction_boards
  add column if not exists type text not null default 'ambos'
  check (type in ('entrada', 'saida', 'ambos'));

alter table transaction_boards
  add column if not exists is_investment boolean not null default false;

alter table transaction_boards
  add column if not exists last_position_import jsonb;

alter table transaction_boards
  add column if not exists position_import_history jsonb not null default '[]'::jsonb;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. categories (migration_categories.sql)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('receita', 'despesa', 'ambos')),
  color text not null default '#6366f1',
  created_at timestamptz default now() not null,
  unique (user_id, name)
);

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

alter table transactions drop constraint if exists transactions_category_check;

create index if not exists categories_user_id_idx on categories(user_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 5. categories.special_dates (migration_special_category_dates.sql)
-- ─────────────────────────────────────────────────────────────────────────
alter table categories add column if not exists special_dates jsonb not null default '[]'::jsonb;


-- ─────────────────────────────────────────────────────────────────────────
-- 6. Tipo "transferencia" em categories e transactions
--    (migration_transferencia_categories.sql)
-- ─────────────────────────────────────────────────────────────────────────
alter table categories drop constraint if exists categories_type_check;
alter table categories add constraint categories_type_check
  check (type in ('receita', 'despesa', 'transferencia', 'ambos'));

alter table transactions drop constraint if exists transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('receita', 'despesa', 'transferencia'));

update transactions
set category = 'Outros'
where type = 'transferencia' and category = 'Transferência';


-- ─────────────────────────────────────────────────────────────────────────
-- 7. transactions: group_label, installments
--    (migration_group_label.sql, migration_installments.sql)
-- ─────────────────────────────────────────────────────────────────────────
alter table transactions add column if not exists group_label text;

alter table transactions
  add column if not exists installment_current integer,
  add column if not exists installment_total integer;


-- ─────────────────────────────────────────────────────────────────────────
-- 8. categorization_rules (migration_rules.sql) — depende de
--    transaction_boards (passo 2) por causa do board_id
-- ─────────────────────────────────────────────────────────────────────────
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

alter table categorization_rules
  add column if not exists match_type text not null default 'contains'
    check (match_type in ('contains', 'starts_with', 'ends_with', 'exact')),
  add column if not exists board_id uuid references transaction_boards(id) on delete set null;

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

create index if not exists categorization_rules_user_id_idx on categorization_rules(user_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 9. categorization_rules.auto_created (migration_rule_auto_created.sql)
-- ─────────────────────────────────────────────────────────────────────────
alter table categorization_rules
  add column if not exists auto_created boolean not null default false;


-- ─────────────────────────────────────────────────────────────────────────
-- 9a. categorization_rules.id: garante default (migration_rules_id_default.sql)
--     "create table if not exists" acima não corrige uma tabela que já existia
--     sem esse default — em algumas contas a coluna id foi criada sem ele,
--     causando erro "null value in column id" no upsert de syncCategoryToRule.
-- ─────────────────────────────────────────────────────────────────────────
alter table categorization_rules alter column id set default gen_random_uuid();


-- ─────────────────────────────────────────────────────────────────────────
-- 9b. categorization_rules: trava contra regra duplicada
--     (migration_rules_unique.sql) — usada pelo upsert de syncCategoryToRule
--     (use-rules.ts) pra criar/atualizar regra automática sem corrida.
-- ─────────────────────────────────────────────────────────────────────────
delete from categorization_rules a
using categorization_rules b
where a.user_id = b.user_id
  and a.keyword = b.keyword
  and a.match_type = b.match_type
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

alter table categorization_rules drop constraint if exists categorization_rules_user_keyword_matchtype_key;
alter table categorization_rules add constraint categorization_rules_user_keyword_matchtype_key
  unique (user_id, keyword, match_type);


-- ─────────────────────────────────────────────────────────────────────────
-- 10. recurring_groups (migration_recurring_groups.sql)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists recurring_groups (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  descriptions text[] not null default '{}',
  created_at timestamptz default now() not null
);

alter table recurring_groups enable row level security;

drop policy if exists "Users can view own recurring groups" on recurring_groups;
drop policy if exists "Users can insert own recurring groups" on recurring_groups;
drop policy if exists "Users can update own recurring groups" on recurring_groups;
drop policy if exists "Users can delete own recurring groups" on recurring_groups;

create policy "Users can view own recurring groups"
  on recurring_groups for select using (auth.uid() = user_id);
create policy "Users can insert own recurring groups"
  on recurring_groups for insert with check (auth.uid() = user_id);
create policy "Users can update own recurring groups"
  on recurring_groups for update using (auth.uid() = user_id);
create policy "Users can delete own recurring groups"
  on recurring_groups for delete using (auth.uid() = user_id);

create index if not exists recurring_groups_user_id_idx on recurring_groups(user_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 11. recurring_subcategories (migration_subcategories.sql)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists recurring_subcategories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now() not null,
  unique(user_id, name)
);

alter table recurring_subcategories enable row level security;

drop policy if exists "Users can manage own subcategories" on recurring_subcategories;

create policy "Users can manage own subcategories"
  on recurring_subcategories for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists recurring_subcategories_user_id_idx on recurring_subcategories(user_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 12. admin_page_views (migration_admin.sql)
--     Nota: as policies de leitura/exclusão são restritas ao e-mail do dono
--     original do projeto (marcio.fanselmo@gmail.com) — em outro projeto
--     Supabase, isso simplesmente não libera acesso a ninguém (comportamento
--     seguro por padrão, só não é útil pro dono desse outro projeto).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists admin_page_views (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  user_email text not null,
  page       text not null,
  created_at timestamptz default now() not null
);

alter table admin_page_views enable row level security;

drop policy if exists "Users can insert own views" on admin_page_views;
drop policy if exists "Admin can select all views" on admin_page_views;
drop policy if exists "Admin can delete old views" on admin_page_views;

create policy "Users can insert own views"
  on admin_page_views for insert
  with check (auth.uid() = user_id);

create policy "Admin can select all views"
  on admin_page_views for select
  using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
        and email = 'marcio.fanselmo@gmail.com'
    )
  );

create policy "Admin can delete old views"
  on admin_page_views for delete
  using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
        and email = 'marcio.fanselmo@gmail.com'
    )
  );

create index if not exists admin_page_views_created_at_idx on admin_page_views(created_at desc);
create index if not exists admin_page_views_user_id_idx    on admin_page_views(user_id);
create index if not exists admin_page_views_page_idx       on admin_page_views(page);


-- ─────────────────────────────────────────────────────────────────────────
-- 13. budget_plans (migration_budget_plans.sql)
-- ─────────────────────────────────────────────────────────────────────────
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

create index if not exists budget_plans_user_id_idx on budget_plans(user_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 14. budget_plans.expenses_target (migration_budget_plan_expenses_target.sql)
--     Já vem na CREATE TABLE acima — este ALTER é só uma garantia extra.
-- ─────────────────────────────────────────────────────────────────────────
alter table budget_plans
  add column if not exists expenses_target numeric not null default 0;


-- ─────────────────────────────────────────────────────────────────────────
-- 15. goals (migration_goals.sql)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null default 'personalizada'
    check (type in ('reserva', 'investimento', 'carro', 'viagem', 'divida', 'imovel', 'personalizada')),
  target_amount numeric not null default 0,
  current_amount numeric not null default 0,
  deadline text,
  color text not null default '#3b82f6',
  last_import jsonb,
  created_at timestamptz default now() not null
);

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

create index if not exists goals_user_id_idx on goals(user_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 16. recurring_decisions (migration_recurring_decisions.sql)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists recurring_decisions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  description_key text not null,
  decision text not null check (decision in ('confirmed', 'ignored')),
  created_at timestamptz default now() not null,
  unique (user_id, description_key)
);

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

create index if not exists recurring_decisions_user_id_idx on recurring_decisions(user_id);


-- ============================================================================
-- FIM — 10 tabelas, RLS habilitado em todas, índices criados.
-- ============================================================================
