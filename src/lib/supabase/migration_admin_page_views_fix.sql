-- ============================================================================
-- Painel /admin → acessos (page views)
-- ============================================================================
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Em 29/09/2026 o painel mostrava tudo zerado e registrava o erro
-- "Could not find the table 'public.admin_page_views'": a tabela nunca foi
-- criada em produção, e o rastreador de páginas falhava em silêncio a cada
-- navegação. Esta migration junta migration_admin.sql com a correção de
-- migration_security.sql (admin = role 'admin', não um e-mail fixo).
-- ============================================================================

create table if not exists public.admin_page_views (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  user_email text not null,
  page       text not null,
  created_at timestamptz default now() not null
);

alter table public.admin_page_views enable row level security;

drop policy if exists "Users can insert own views" on public.admin_page_views;
drop policy if exists "Admin can select all views" on public.admin_page_views;
drop policy if exists "Admin can delete old views" on public.admin_page_views;

-- Cada usuário logado registra só a própria navegação.
create policy "Users can insert own views"
  on public.admin_page_views for insert
  with check (auth.uid() = user_id);

-- Só admin lê e apaga (limpeza dos 30 dias).
create policy "Admin can select all views"
  on public.admin_page_views for select
  using (public.is_app_admin());

create policy "Admin can delete old views"
  on public.admin_page_views for delete
  using (public.is_app_admin());

create index if not exists admin_page_views_created_at_idx on public.admin_page_views(created_at desc);
create index if not exists admin_page_views_user_id_idx    on public.admin_page_views(user_id);
create index if not exists admin_page_views_page_idx       on public.admin_page_views(page);

-- Faz a API do Supabase enxergar a tabela nova na hora.
notify pgrst, 'reload schema';
