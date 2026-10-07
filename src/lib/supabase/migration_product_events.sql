-- ============================================================================
-- Marcos da jornada do usuário (medição do funil dentro do app)
-- ============================================================================
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- O painel enxergava até o checkout; depois do cadastro, nada. Esta tabela
-- guarda os marcos de cada pessoa (primeira conta, primeira importação, tela
-- bloqueada vista, tarefas do teste...) para o Admin mostrar onde ela para.
--
-- dedupe_key: um marco é registrado uma vez por (usuário, evento, chave).
-- Chave vazia = uma vez na vida; 'reports' = uma vez por tela, e assim por diante.
-- Não guarda dado financeiro: só o nome do marco e, às vezes, uma etiqueta.
-- ============================================================================

create table if not exists public.product_events (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  event       text not null,
  dedupe_key  text not null default '',
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz default now() not null,
  unique (user_id, event, dedupe_key)
);

alter table public.product_events enable row level security;

drop policy if exists "Users insert own events" on public.product_events;
drop policy if exists "Users read own events" on public.product_events;
drop policy if exists "Admin reads all events" on public.product_events;

create policy "Users insert own events"
  on public.product_events for insert
  with check (auth.uid() = user_id);

-- A própria pessoa lê os seus marcos (a jornada do teste vai usar isso).
create policy "Users read own events"
  on public.product_events for select
  using (auth.uid() = user_id);

create policy "Admin reads all events"
  on public.product_events for select
  using (public.is_app_admin());

create index if not exists product_events_event_created_idx on public.product_events(event, created_at desc);

notify pgrst, 'reload schema';
