-- ============================================================================
-- adjustment_decisions — o que o usuário decidiu sobre cada Ajuste sugerido
-- ============================================================================
-- A tela Ajustes sugeridos cruza os dados e propõe correções (ex.: um PIX que sai do
-- Itaú e entra no C6 contando como despesa E receita). Esta tabela lembra:
--   snoozed   → "Agora não": volta a aparecer depois de `until`
--   dismissed → "Não sugerir de novo"
--   applied   → aplicada; `undo` guarda o estado anterior para "Desfazer"
-- `key` identifica a sugestão (ex.: pair|<conta origem>|<conta destino>|TEXTO).
-- Idempotente.
-- ============================================================================

create table if not exists adjustment_decisions (
  user_id    uuid references auth.users(id) on delete cascade not null,
  key        text not null,
  status     text not null check (status in ('snoozed', 'dismissed', 'applied')),
  until      date,
  undo       jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table adjustment_decisions enable row level security;

drop policy if exists "users manage own adjustment decisions" on adjustment_decisions;
create policy "users manage own adjustment decisions"
  on adjustment_decisions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
