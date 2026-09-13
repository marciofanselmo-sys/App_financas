-- ============================================================================
-- user_suggestions — feedback dos usuários (Seção 9 do checklist)
-- Rodar no SQL Editor do Supabase
-- ============================================================================

create table if not exists user_suggestions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  user_email text not null,
  message text not null
    check (char_length(trim(message)) >= 3 and char_length(message) <= 2000),
  status text not null default 'nova'
    check (status in ('nova', 'lida', 'em_analise', 'concluida')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists user_suggestions_user_id_idx on user_suggestions(user_id);
create index if not exists user_suggestions_status_idx on user_suggestions(status);
create index if not exists user_suggestions_created_at_idx on user_suggestions(created_at desc);

alter table user_suggestions enable row level security;

drop policy if exists "Users can view own suggestions" on user_suggestions;
drop policy if exists "Users can insert own suggestions" on user_suggestions;
drop policy if exists "Admin can view all suggestions" on user_suggestions;
drop policy if exists "Admin can update suggestion status" on user_suggestions;

create policy "Users can view own suggestions"
  on user_suggestions for select
  using (auth.uid() = user_id);

create policy "Users can insert own suggestions"
  on user_suggestions for insert
  with check (auth.uid() = user_id);

create policy "Admin can view all suggestions"
  on user_suggestions for select
  using (public.is_app_admin());

create policy "Admin can update suggestion status"
  on user_suggestions for update
  using (public.is_app_admin())
  with check (public.is_app_admin());

create or replace function public.touch_user_suggestions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_suggestions_updated_at on user_suggestions;
create trigger user_suggestions_updated_at
  before update on user_suggestions
  for each row execute function public.touch_user_suggestions_updated_at();
