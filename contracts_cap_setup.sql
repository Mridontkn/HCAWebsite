-- HCA CONTRACTS + SALARY CAP SETUP
-- Run once after hca_v12_setup.sql (or append this file to it).

create table if not exists public.league_settings (
  id uuid primary key default gen_random_uuid(),
  season text not null unique,
  salary_cap numeric(12,2) not null default 100000000,
  currency text not null default 'CAD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.league_settings enable row level security;
drop policy if exists "Public can read league settings" on public.league_settings;
create policy "Public can read league settings" on public.league_settings for select to anon, authenticated using (true);
drop policy if exists "Admins can insert league settings" on public.league_settings;
create policy "Admins can insert league settings" on public.league_settings for insert to authenticated with check (public.is_hca_admin());
drop policy if exists "Admins can update league settings" on public.league_settings;
create policy "Admins can update league settings" on public.league_settings for update to authenticated using (public.is_hca_admin()) with check (public.is_hca_admin());
drop policy if exists "Admins can delete league settings" on public.league_settings;
create policy "Admins can delete league settings" on public.league_settings for delete to authenticated using (public.is_hca_admin());

insert into public.league_settings(season,salary_cap,currency)
values ('Season 16',100000000,'CAD')
on conflict(season) do nothing;

create table if not exists public.player_contracts (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.players(id) on delete cascade,
  team_id text references public.teams(id) on delete set null,
  season text not null default 'Season 16',
  start_season integer not null default 16,
  term_years integer not null default 1 check (term_years >= 1),
  annual_salary numeric(12,2) not null default 0 check (annual_salary >= 0),
  contract_type text not null default 'STANDARD',
  status text not null default 'ACTIVE',
  signed_date date,
  notes text,
  created_by_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_contracts enable row level security;
drop policy if exists "Public can read player contracts" on public.player_contracts;
create policy "Public can read player contracts" on public.player_contracts for select to anon, authenticated using (true);
drop policy if exists "Admins can insert player contracts" on public.player_contracts;
create policy "Admins can insert player contracts" on public.player_contracts for insert to authenticated with check (public.is_hca_admin());
drop policy if exists "Admins can update player contracts" on public.player_contracts;
create policy "Admins can update player contracts" on public.player_contracts for update to authenticated using (public.is_hca_admin()) with check (public.is_hca_admin());
drop policy if exists "Admins can delete player contracts" on public.player_contracts;
create policy "Admins can delete player contracts" on public.player_contracts for delete to authenticated using (public.is_hca_admin());

create or replace function public.player_contract_end_season(p_start integer, p_term integer)
returns integer
language sql
immutable
as $$ select p_start + greatest(p_term,1) - 1 $$;

-- Optional helper for the UI / future API use.
create or replace function public.team_cap_summary(p_team_id text, p_season_number integer)
returns table(contract_count integer, cap_hit numeric, salary_cap numeric, cap_space numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(pc.id)::integer,
    coalesce(sum(pc.annual_salary),0)::numeric,
    coalesce((select ls.salary_cap from public.league_settings ls where ls.season = 'Season ' || p_season_number limit 1),0)::numeric,
    (coalesce((select ls.salary_cap from public.league_settings ls where ls.season = 'Season ' || p_season_number limit 1),0) - coalesce(sum(pc.annual_salary),0))::numeric
  from public.player_contracts pc
  where pc.team_id = p_team_id
    and pc.status = 'ACTIVE'
    and p_season_number between pc.start_season and public.player_contract_end_season(pc.start_season,pc.term_years);
$$;
revoke all on function public.team_cap_summary(text,integer) from public;
grant execute on function public.team_cap_summary(text,integer) to anon, authenticated;
