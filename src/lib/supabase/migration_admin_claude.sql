-- ============================================================================
-- Painel /admin → Erros → "Mandar para o Claude"
-- ============================================================================
-- Rodar no SQL Editor do Supabase depois de migration_admin_paineis.sql.
-- Idempotente.
--
-- claude_ref         código curto que vai no PR ("NOBLI-ERRO: abc12345"); é por
--                    ele que o aviso de PR aprovado acha o erro certo
-- claude_session_url chat do Claude que está cuidando do erro
-- pr_url             PR que corrigiu, preenchido quando ele entra no main
-- ============================================================================

alter table public.app_error_status add column if not exists claude_ref         text;
alter table public.app_error_status add column if not exists claude_session_url text;
alter table public.app_error_status add column if not exists claude_sent_at     timestamptz;
alter table public.app_error_status add column if not exists pr_url             text;

create unique index if not exists app_error_status_claude_ref_idx
  on public.app_error_status(claude_ref) where claude_ref is not null;

notify pgrst, 'reload schema';
