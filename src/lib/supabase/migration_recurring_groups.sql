-- Executar no SQL Editor do Supabase

create table if not exists recurring_groups (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  descriptions text[] not null default '{}',
  created_at timestamptz default now() not null
);

alter table recurring_groups enable row level security;

drop policy if exists "Users can view own recurring groups" on recurring_groups;
drop policy if exists "Users can insert own recurring groups" on recurring_groups;
drop policy if exists "Users can update own recurring groups" on recurring_groups;
drop policy if exists "Users can delete own recurring groups" on recurring_groups;

create policy "Users can view own recurring groups"
  on recurring_groups for select using (auth.uid() = user_id);
create policy "Users can insert own recurring groups"
  on recurring_groups for insert with check (auth.uid() = user_id);
create policy "Users can update own recurring groups"
  on recurring_groups for update using (auth.uid() = user_id);
create policy "Users can delete own recurring groups"
  on recurring_groups for delete using (auth.uid() = user_id);

create index if not exists recurring_groups_user_id_idx on recurring_groups(user_id);
