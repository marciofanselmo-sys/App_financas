-- ============================================================================
-- Fim do teste: qual conta fica ativa no Grátis
-- ============================================================================
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Depois do teste, quem volta ao Grátis com mais contas do que o plano permite
-- continua vendo todas, mas só uma fica ativa (importar e editar). A pessoa
-- escolhe qual; sem escolha, vale a conta mais antiga. Quem grava é o servidor.
-- ============================================================================

alter table public.user_trials add column if not exists conta_ativa uuid;
