-- Bu SQL ayni Supabase projesinde flashcards-app ile birlikte calisabilecek sekilde tasarlandi.
-- Izolasyon: tablo adlari mcq_* prefix ile; RLS policy'leri auth.uid() = user_id kosuluyla.
-- Flashcards tablolarıyla cakisma yoktur (prefix: flashcard_*).
-- Core public schema for Multiple Choice Questions cloud set sync.
-- This table stores MCQ set records per authenticated user.

create table if not exists public.mcq_sets (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  set_name text not null,
  file_name text not null,
  source_format text not null check (source_format in ('json', 'markdown')),
  source_path text not null default '',
  raw_source text not null default '',
  questions_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

alter table public.mcq_sets
  add column if not exists source_path text not null default '';

-- Existing projects created before 2026-04-24 may still have a global
-- id-only primary key. That blocks two different users from importing the
-- same filename-derived set id under RLS, so migrate the key to user scope.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mcq_sets'::regclass
      and conname = 'mcq_sets_pkey'
  ) then
    alter table public.mcq_sets drop constraint mcq_sets_pkey;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mcq_sets'::regclass
      and conname = 'mcq_sets_pkey'
  ) then
    alter table public.mcq_sets
      add constraint mcq_sets_pkey primary key (user_id, id);
  end if;
end $$;

create index if not exists mcq_sets_user_updated_idx
  on public.mcq_sets (user_id, updated_at desc);

create index if not exists mcq_sets_user_slug_idx
  on public.mcq_sets (user_id, slug);

alter table public.mcq_sets enable row level security;

drop policy if exists "mcq_sets_select_own" on public.mcq_sets;
create policy "mcq_sets_select_own"
on public.mcq_sets
for select
using (auth.uid() = user_id);

drop policy if exists "mcq_sets_insert_own" on public.mcq_sets;
create policy "mcq_sets_insert_own"
on public.mcq_sets
for insert
with check (auth.uid() = user_id);

drop policy if exists "mcq_sets_update_own" on public.mcq_sets;
create policy "mcq_sets_update_own"
on public.mcq_sets
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "mcq_sets_delete_own" on public.mcq_sets;
create policy "mcq_sets_delete_own"
on public.mcq_sets
for delete
using (auth.uid() = user_id);
