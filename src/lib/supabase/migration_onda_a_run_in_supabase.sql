-- =============================================================================
-- ONDA A — Cole TODO este arquivo no Supabase → SQL Editor → Run
-- (NÃO cole o nome do arquivo — só o conteúdo SQL abaixo)
-- =============================================================================

-- 1) Corrige RLS de user_profiles (recursão infinita)
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

-- 2) Tabela user_preferences (% padrão de investimento)
create table if not exists user_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  investment_pct numeric not null default 20
    check (investment_pct >= 0 and investment_pct <= 100),
  theme text not null default 'system'
    check (theme in ('light', 'dark', 'system')),
  default_board_id uuid references transaction_boards(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists user_preferences_user_id_idx on user_preferences(user_id);

alter table user_preferences enable row level security;

drop policy if exists "Users can view own preferences" on user_preferences;
drop policy if exists "Users can insert own preferences" on user_preferences;
drop policy if exists "Users can update own preferences" on user_preferences;

create policy "Users can view own preferences"
  on user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own preferences"
  on user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.touch_user_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_preferences_updated_at on user_preferences;
create trigger user_preferences_updated_at
  before update on user_preferences
  for each row execute function public.touch_user_preferences_updated_at();

insert into user_preferences (user_id, investment_pct)
select u.id, 20
from auth.users u
where not exists (
  select 1 from user_preferences p where p.user_id = u.id
);

create or replace function public.handle_new_user_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id, investment_pct)
  values (new.id, 20)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_preferences on auth.users;
create trigger on_auth_user_created_preferences
  after insert on auth.users
  for each row execute function public.handle_new_user_preferences();
