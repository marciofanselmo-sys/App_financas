-- =============================================================================
-- SEGURANÇA — Cole TODO este arquivo no Supabase → SQL Editor → Run
-- Bloco 12: admin por role (user_profiles) + policies alinhadas
-- =============================================================================

-- 1) is_app_admin() usa role no banco — não depende de e-mail hardcoded nem .env
create or replace function public.is_app_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

grant execute on function public.is_app_admin() to authenticated;

-- 2) Garante role admin para o owner (ajuste o e-mail se necessário)
insert into public.user_profiles (user_id, full_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  'admin'
from auth.users u
where u.email = 'marcio.fanselmo@gmail.com'
on conflict (user_id) do update
  set role = 'admin',
      updated_at = now();

-- 3) admin_page_views — policies via is_app_admin()
drop policy if exists "Admin can select all views" on admin_page_views;
drop policy if exists "Admin can delete old views" on admin_page_views;

create policy "Admin can select all views"
  on admin_page_views for select
  using (public.is_app_admin());

create policy "Admin can delete old views"
  on admin_page_views for delete
  using (public.is_app_admin());
