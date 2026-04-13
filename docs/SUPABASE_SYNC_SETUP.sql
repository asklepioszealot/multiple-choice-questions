-- Dedicated study-state setup for Multiple Choice Questions.
-- User progress lives in a single per-user row.

create table if not exists public.mcq_user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists mcq_user_state_updated_idx
  on public.mcq_user_state (updated_at desc);

alter table public.mcq_user_state enable row level security;

drop policy if exists "mcq_user_state_select_own" on public.mcq_user_state;
create policy "mcq_user_state_select_own"
on public.mcq_user_state
for select
using (auth.uid() = user_id);

drop policy if exists "mcq_user_state_insert_own" on public.mcq_user_state;
create policy "mcq_user_state_insert_own"
on public.mcq_user_state
for insert
with check (auth.uid() = user_id);

drop policy if exists "mcq_user_state_update_own" on public.mcq_user_state;
create policy "mcq_user_state_update_own"
on public.mcq_user_state
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "mcq_user_state_delete_own" on public.mcq_user_state;
create policy "mcq_user_state_delete_own"
on public.mcq_user_state
for delete
using (auth.uid() = user_id);
