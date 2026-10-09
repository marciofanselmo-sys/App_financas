-- ============================================================================
-- Descadastro de e-mails de lembrete e oferta
-- ============================================================================
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Um e-mail por linha. Quem está aqui não recebe mais os e-mails de marketing
-- (lembretes do teste, oferta, checkout abandonado). Avisos de conta e de
-- cobrança continuam. Chave = e-mail em minúsculas, porque o checkout
-- abandonado chega de quem nem tem conta no app.
-- Só o servidor lê e grava (chave de serviço): RLS ligado e sem política.
-- ============================================================================

create table if not exists public.email_optouts (
  email      text primary key,
  origem     text,
  created_at timestamptz not null default now()
);

alter table public.email_optouts enable row level security;
