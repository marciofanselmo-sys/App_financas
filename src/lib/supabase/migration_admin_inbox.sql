-- ============================================================================
-- Painel /admin → E-mails: o que já foi lido
-- ============================================================================
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Os e-mails ficam na Resend (recebimento); aqui só guardamos QUAIS já foram
-- abertos, porque a Resend não tem "lido / não lido". Nada do conteúdo do
-- e-mail é copiado para o banco.
-- ============================================================================

create table if not exists public.inbox_read (
  email_id text primary key,               -- id do e-mail recebido na Resend
  read_at  timestamptz not null default now(),
  read_by  uuid references auth.users(id) on delete set null
);

alter table public.inbox_read enable row level security;

drop policy if exists "admin manages inbox read" on public.inbox_read;
create policy "admin manages inbox read"
  on public.inbox_read for all
  using (public.is_app_admin())
  with check (public.is_app_admin());

notify pgrst, 'reload schema';
