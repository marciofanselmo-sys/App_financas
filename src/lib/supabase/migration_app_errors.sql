-- ============================================================================
-- app_errors — erros do app vistos pelo usuário, para o admin enxergar
-- ============================================================================
-- Sem isto, uma importação que falha mostra a mensagem ao usuário e some: o
-- dono do app só fica sabendo se o usuário procurar por conta própria. Em
-- set/2026 um erro de versão do worker do pdf.js impediu toda importação de
-- PDF e só apareceu porque o próprio dono tentou importar.
--
-- O que é gravado: onde aconteceu, a mensagem técnica, o código, a rota e o
-- navegador. NUNCA conteúdo de extrato, valores ou descrições de transação —
-- o app não passa nada disso para o registro (LGPD).
-- ============================================================================

create table if not exists app_errors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  context     text not null,   -- onde: ex. 'useGoals.create', 'window.error'
  message     text,            -- mensagem técnica, truncada no cliente
  code        text,            -- código do Postgres/HTTP, quando houver
  route       text,            -- tela em que o usuário estava
  user_agent  text
);

create index if not exists app_errors_created_at_idx on app_errors (created_at desc);

alter table app_errors enable row level security;

-- Todo usuário logado pode registrar os PRÓPRIOS erros — e só isso.
drop policy if exists "users insert own errors" on app_errors;
create policy "users insert own errors"
  on app_errors for insert
  with check (auth.uid() = user_id);

-- Só o admin lê. Um usuário nunca vê o erro de outro.
drop policy if exists "admin reads errors" on app_errors;
create policy "admin reads errors"
  on app_errors for select
  using (public.is_app_admin());

-- Só o admin apaga — usado para limpar registros antigos (retenção de 30 dias).
drop policy if exists "admin deletes errors" on app_errors;
create policy "admin deletes errors"
  on app_errors for delete
  using (public.is_app_admin());
