-- Corrige recursão infinita na policy de admin em user_profiles.
-- Rodar no SQL Editor se SELECT em user_profiles retorna erro 42P17.

create or replace function public.is_app_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (auth.jwt() ->> 'email') in ('marcio.fanselmo@gmail.com'),
    false
  );
$$;

drop policy if exists "Admin can view all profiles" on user_profiles;

create policy "Admin can view all profiles"
  on user_profiles for select
  using (auth.uid() = user_id or public.is_app_admin());
