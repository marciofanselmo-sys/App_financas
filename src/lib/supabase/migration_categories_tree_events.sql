-- ============================================================================
-- Categorias em dois níveis + Eventos (Etapa 0 — só estrutura)
-- ============================================================================
-- Novo modelo:
--   Categoria (Moradia, Alimentação…) > Subcategoria (Aluguel, Mercado…)
-- As duas moram na mesma tabela `categories`: parent_id vazio = categoria
-- principal; preenchido = subcategoria. O lançamento continua guardando o
-- NOME em transactions.category (principal ou sub) — o pai sai da tabela.
--
-- Eventos substituem as "categorias isoladas" (special_dates): o lançamento
-- fica na categoria normal E ganha o evento (ex.: "Viagem Rio"), para ver o
-- total gasto nele sem tirar o gasto de Alimentação, Transporte etc.
--
-- Nada aqui muda o que o app mostra hoje: colunas novas nascem vazias.
-- ============================================================================

-- 1. Categoria-mãe. Apagar a mãe solta as filhas (viram principais), nunca
--    apaga subcategoria em cascata.
alter table categories
  add column if not exists parent_id uuid references categories(id) on delete set null;

create index if not exists categories_parent_id_idx on categories(parent_id);

-- 2. Etiqueta 50/30/20 — sugestão; o usuário ajusta em Planejamento.
alter table categories
  add column if not exists bucket text
    check (bucket in ('essencial', 'estilo', 'futuro'));

-- 3. Eventos
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default '#6366f1',
  -- Encerrado: some da lista de escolha nos lançamentos, continua nos relatórios.
  closed      boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

alter table events enable row level security;

drop policy if exists "users manage own events" on events;
create policy "users manage own events"
  on events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists events_user_id_idx on events(user_id);

-- 4. Evento do lançamento. Apagar o evento só desmarca os lançamentos.
alter table transactions
  add column if not exists event_id uuid references events(id) on delete set null;

create index if not exists transactions_event_id_idx on transactions(event_id);
