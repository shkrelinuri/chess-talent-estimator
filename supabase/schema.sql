create table if not exists public.unlocked_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  unlocked boolean not null default false,
  license_key text,
  unlocked_at timestamptz
);

alter table public.unlocked_users enable row level security;

drop policy if exists "Users can read their own unlock" on public.unlocked_users;
create policy "Users can read their own unlock"
  on public.unlocked_users for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own unlock" on public.unlocked_users;
create policy "Users can insert their own unlock"
  on public.unlocked_users for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own unlock" on public.unlocked_users;
create policy "Users can update their own unlock"
  on public.unlocked_users for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own unlock" on public.unlocked_users;
create policy "Users can delete their own unlock"
  on public.unlocked_users for delete
  using (auth.uid() = user_id);
