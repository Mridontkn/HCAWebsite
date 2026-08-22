-- HCA PLAYOFF BRACKET SETUP
-- Run once in Supabase SQL Editor.

create table if not exists public.playoff_brackets (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  name text not null default 'HCA Playoffs',
  bracket_data jsonb not null default '{}'::jsonb,
  created_by_id uuid,
  updated_by_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season)
);

alter table public.playoff_brackets enable row level security;

drop policy if exists "Public can read playoff brackets" on public.playoff_brackets;
create policy "Public can read playoff brackets" on public.playoff_brackets for select to anon, authenticated using (true);

drop policy if exists "Admins can insert playoff brackets" on public.playoff_brackets;
create policy "Admins can insert playoff brackets" on public.playoff_brackets for insert to authenticated with check (auth.role() = 'authenticated');

drop policy if exists "Admins can update playoff brackets" on public.playoff_brackets;
create policy "Admins can update playoff brackets" on public.playoff_brackets for update to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Admins can delete playoff brackets" on public.playoff_brackets;
create policy "Admins can delete playoff brackets" on public.playoff_brackets for delete to authenticated using (auth.role() = 'authenticated');
