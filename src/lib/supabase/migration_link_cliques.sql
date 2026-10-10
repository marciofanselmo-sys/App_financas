-- ============================================================================
-- Cliques nos links do teste grátis (/teste-gratis, /instagram, /teste)
-- ============================================================================
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Uma linha por clique de gente (robôs de prévia ficam de fora no código).
-- `visitante` = id anônimo guardado num cookie, para contar pessoas e não só
-- cliques. Nenhum dado pessoal: só a origem (UTMs) e se já estava logado.
-- Grava só o servidor (chave de serviço); lê só o admin.
-- ============================================================================

create table if not exists public.link_cliques (
  id           bigserial primary key,
  visitante    uuid,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  logado       boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists link_cliques_created_at_idx on public.link_cliques (created_at);

alter table public.link_cliques enable row level security;

drop policy if exists "Admin reads link clicks" on public.link_cliques;
create policy "Admin reads link clicks" on public.link_cliques
  for select using (public.is_app_admin());
