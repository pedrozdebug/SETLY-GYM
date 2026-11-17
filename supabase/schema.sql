-- Optional backend for Setly Gym cloud sync (Supabase / Postgres).
-- Run in the Supabase SQL editor, then set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
create table if not exists public.setly_records (
  user_id    uuid    not null references auth.users(id) on delete cascade,
  tbl        text    not null,
  rid        text    not null,
  data       jsonb,
  updated_at bigint  not null,
  deleted    boolean not null default false,
  primary key (user_id, tbl, rid)
);
create index if not exists setly_records_user_updated on public.setly_records (user_id, updated_at);

alter table public.setly_records enable row level security;

create policy "own rows - select" on public.setly_records for select using (auth.uid() = user_id);
create policy "own rows - insert" on public.setly_records for insert with check (auth.uid() = user_id);
create policy "own rows - update" on public.setly_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows - delete" on public.setly_records for delete using (auth.uid() = user_id);
