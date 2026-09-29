-- ============================================================================
-- Painel /admin → Usuários: dar/tirar admin e plano de cortesia
-- ============================================================================
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- Quem grava é a rota /api/admin/users, no servidor, com a chave de serviço —
-- depois de conferir que quem pediu é admin. Nada disso fica exposto ao
-- navegador.
-- ============================================================================

-- 1) Admin é quem tem role = 'admin' no perfil. As migrations antigas tinham
--    versões que olhavam só para um e-mail fixo; esta é a que vale.
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

-- 2) O dono continua admin (senão a troca acima o trancaria para fora).
insert into public.user_profiles (user_id, full_name, role)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', ''), 'admin'
from auth.users u
where u.email = 'marcio.fanselmo@gmail.com'
on conflict (user_id) do update set role = 'admin', updated_at = now();

-- 3) A trava contra auto-promoção continua valendo para o usuário comum, mas
--    deixa passar o servidor (service_role) e o SQL Editor (sem JWT). Antes
--    ela barrava os dois, porque auth.uid() é nulo nesses casos.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and old.role = 'user'
     and coalesce(auth.role(), '') <> 'service_role'
     and auth.uid() is not null
  then
    if not exists (
      select 1 from user_profiles
      where user_id = auth.uid() and role = 'admin'
    ) then
      raise exception 'Alteração de role não permitida';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;
