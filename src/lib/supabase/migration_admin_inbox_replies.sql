-- ============================================================================
-- Painel /admin → E-mails: quais e-mails já foram respondidos
-- ============================================================================
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Cada resposta enviada pelo botão Responder vira uma linha aqui, para a
-- lista mostrar "Respondido". O texto da resposta não é copiado: a cópia
-- fica na Resend (Emails enviados).
-- ============================================================================

create table if not exists public.inbox_replies (
  id         bigint generated always as identity primary key,
  email_id   text not null,                -- id do e-mail recebido na Resend
  replied_to text not null,                -- endereço que recebeu a resposta
  replied_at timestamptz not null default now(),
  replied_by uuid references auth.users(id) on delete set null
);

create index if not exists inbox_replies_email_id_idx on public.inbox_replies (email_id);

alter table public.inbox_replies enable row level security;

drop policy if exists "admin manages inbox replies" on public.inbox_replies;
create policy "admin manages inbox replies"
  on public.inbox_replies for all
  using (public.is_app_admin())
  with check (public.is_app_admin());

notify pgrst, 'reload schema';
