-- ============================================================================
-- user_profiles — perfil de cada usuário (SaaS)
-- ============================================================================
-- Rodar no SQL Editor do Supabase (projeto existente).
-- Cria a tabela, RLS, backfill de auth.users e trigger para novos cadastros.
--
-- Admin inicial: marcio.fanselmo@gmail.com (ajuste o array admin_emails abaixo
-- se o e-mail do owner for outro).
-- ============================================================================

create table if not exists user_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  full_name text not null default '',
  role text not null default 'user'
    check (role in ('user', 'admin')),
  onboarding_completed boolean not null default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists user_profiles_user_id_idx on user_profiles(user_id);
create index if not exists user_profiles_role_idx on user_profiles(role);

alter table user_profiles enable row level security;

drop policy if exists "Users can view own profile" on user_profiles;
drop policy if exists "Users can update own profile" on user_profiles;
drop policy if exists "Admin can view all profiles" on user_profiles;

create policy "Users can view own profile"
  on user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own profile"
  on user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admin lê todos os perfis (checa role na própria tabela user_profiles)
create policy "Admin can view all profiles"
  on user_profiles for select
  using (
    exists (
      select 1 from user_profiles admin
      where admin.user_id = auth.uid()
        and admin.role = 'admin'
    )
  );

-- Impede usuário comum de promover a si mesmo a admin
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and old.role = 'user' then
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

drop trigger if exists user_profiles_role_guard on user_profiles;
create trigger user_profiles_role_guard
  before update on user_profiles
  for each row execute function public.prevent_profile_role_escalation();

-- ── Backfill: usuários já existentes em auth.users ───────────────────────
insert into user_profiles (user_id, full_name, role, created_at)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    split_part(u.email, '@', 1)
  ) as full_name,
  case
    when u.email in ('marcio.fanselmo@gmail.com') then 'admin'
    else 'user'
  end as role,
  u.created_at
from auth.users u
where not exists (
  select 1 from user_profiles p where p.user_id = u.id
);

-- ── Trigger: perfil automático em novos cadastros ─────────────────────────
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    case
      when new.email in ('marcio.fanselmo@gmail.com') then 'admin'
      else 'user'
    end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();
