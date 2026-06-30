-- Executar no SQL Editor do Supabase

-- 1. Tabela de page views para o painel admin
create table if not exists admin_page_views (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  user_email text not null,
  page       text not null,
  created_at timestamptz default now() not null
);

-- 2. RLS
alter table admin_page_views enable row level security;

drop policy if exists "Users can insert own views"  on admin_page_views;
drop policy if exists "Admin can select all views"  on admin_page_views;
drop policy if exists "Admin can delete old views"  on admin_page_views;

-- Qualquer usuário autenticado pode registrar sua própria navegação
create policy "Users can insert own views"
  on admin_page_views for insert
  with check (auth.uid() = user_id);

-- Somente o admin pode ler todos os registros
create policy "Admin can select all views"
  on admin_page_views for select
  using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
        and email = 'marcio.fanselmo@gmail.com'
    )
  );

-- Somente o admin pode deletar (para cleanup dos 30 dias)
create policy "Admin can delete old views"
  on admin_page_views for delete
  using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
        and email = 'marcio.fanselmo@gmail.com'
    )
  );

-- 3. Índices para performance nas queries do dashboard
create index if not exists admin_page_views_created_at_idx on admin_page_views(created_at desc);
create index if not exists admin_page_views_user_id_idx    on admin_page_views(user_id);
create index if not exists admin_page_views_page_idx       on admin_page_views(page);
