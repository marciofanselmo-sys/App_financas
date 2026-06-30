create table if not exists recurring_subcategories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now() not null,
  unique(user_id, name)
);

alter table recurring_subcategories enable row level security;

create policy "Users can manage own subcategories"
  on recurring_subcategories for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists recurring_subcategories_user_id_idx on recurring_subcategories(user_id);
