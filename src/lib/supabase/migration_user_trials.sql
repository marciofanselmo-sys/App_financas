-- ============================================================================
-- Teste de 7 dias (5 dias + até 48h de bônus pela jornada)
-- ============================================================================
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Uma linha por teste. O fim do teste = base_ends_at + bonus_hours.
-- Só o servidor grava (chave de serviço): o navegador lê o próprio teste, mas
-- não consegue criar outro nem esticar o relógio.
--
-- user_id sem FK de propósito: se a pessoa apagar a conta, a linha fica e o
-- e-mail continua marcado — um teste por e-mail, mesmo recriando a conta.
-- ============================================================================

create table if not exists public.user_trials (
  user_id        uuid primary key,
  email          text not null,
  started_at     timestamptz not null default now(),
  base_ends_at   timestamptz not null,
  bonus_hours    integer not null default 0 check (bonus_hours between 0 and 48),
  origem         jsonb not null default '{}'::jsonb,
  ended_seen_at  timestamptz
);

create unique index if not exists user_trials_email_idx on public.user_trials (lower(email));

alter table public.user_trials enable row level security;

drop policy if exists "Users read own trial" on public.user_trials;
drop policy if exists "Admin reads all trials" on public.user_trials;

create policy "Users read own trial"
  on public.user_trials for select
  using (auth.uid() = user_id);

create policy "Admin reads all trials"
  on public.user_trials for select
  using (public.is_app_admin());

notify pgrst, 'reload schema';
