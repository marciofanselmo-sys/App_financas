-- ============================================================================
-- csv_mappings — formatos de CSV que o usuário já ensinou ao app
-- ============================================================================
-- Um CSV de banco sem parser próprio cai no mapeamento manual: o usuário diz
-- qual coluna é data, valor e descrição. Antes o app esquecia, e na próxima
-- importação do mesmo banco perguntava tudo de novo. Agora guarda o
-- mapeamento, identificado pela "impressão digital" do cabeçalho do arquivo,
-- e aplica sozinho quando o mesmo formato volta.
--
-- Guarda só NOMES DE COLUNA e a convenção de sinal — nunca conteúdo do
-- arquivo. Por isso um dia pode ser compartilhado entre usuários (o layout do
-- CSV de um banco é o mesmo para todos); hoje é por usuário.
-- ============================================================================

create table if not exists csv_mappings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  fingerprint  text not null,     -- hash do cabeçalho normalizado
  headers      text[] not null,   -- cabeçalho original, para leitura humana
  mapping      jsonb not null,    -- { data, valor, descricao, tipo?, categoria?, sinal }
  times_used   integer not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, fingerprint)
);

alter table csv_mappings enable row level security;

drop policy if exists "users manage own csv mappings" on csv_mappings;
create policy "users manage own csv mappings"
  on csv_mappings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
