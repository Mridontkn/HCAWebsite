-- HCA V12 FEATURE SETUP
-- Run this once in Supabase SQL Editor AFTER admin_setup.sql.
-- This adds: teams admin writes, news/feed, transactions, playoff years,
-- and GM/team user assignments.

-- ============================================================
-- TEAM WRITE POLICIES
-- ============================================================
alter table public.teams enable row level security;
drop policy if exists "HCA admins can insert teams" on public.teams;
create policy "HCA admins can insert teams" on public.teams for insert to authenticated with check (public.is_hca_admin());
drop policy if exists "HCA admins can update teams" on public.teams;
create policy "HCA admins can update teams" on public.teams for update to authenticated using (public.is_hca_admin()) with check (public.is_hca_admin());
drop policy if exists "HCA admins can delete teams" on public.teams;
create policy "HCA admins can delete teams" on public.teams for delete to authenticated using (public.is_hca_admin());

-- ============================================================
-- NEWS / FEED
-- ============================================================
create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  post_type text not null default 'NEWS',
  team_id text references public.teams(id) on delete set null,
  published boolean not null default false,
  published_at timestamptz,
  created_by_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.news_posts enable row level security;
drop policy if exists "Public can read published news" on public.news_posts;
create policy "Public can read published news" on public.news_posts for select to anon, authenticated using (published = true or public.is_hca_admin());
drop policy if exists "Admins can insert news" on public.news_posts;
create policy "Admins can insert news" on public.news_posts for insert to authenticated with check (public.is_hca_admin());
drop policy if exists "Admins can update news" on public.news_posts;
create policy "Admins can update news" on public.news_posts for update to authenticated using (public.is_hca_admin()) with check (public.is_hca_admin());
drop policy if exists "Admins can delete news" on public.news_posts;
create policy "Admins can delete news" on public.news_posts for delete to authenticated using (public.is_hca_admin());

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  season text not null default 'Season 16',
  transaction_date date,
  type text not null default 'OTHER',
  player_id text references public.players(id) on delete set null,
  from_team_id text references public.teams(id) on delete set null,
  to_team_id text references public.teams(id) on delete set null,
  details text,
  status text not null default 'COMPLETED',
  created_by_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.transactions enable row level security;
drop policy if exists "Public can read transactions" on public.transactions;
create policy "Public can read transactions" on public.transactions for select to anon, authenticated using (true);
drop policy if exists "Admins can insert transactions" on public.transactions;
create policy "Admins can insert transactions" on public.transactions for insert to authenticated with check (public.is_hca_admin());
drop policy if exists "Admins can update transactions" on public.transactions;
create policy "Admins can update transactions" on public.transactions for update to authenticated using (public.is_hca_admin()) with check (public.is_hca_admin());
drop policy if exists "Admins can delete transactions" on public.transactions;
create policy "Admins can delete transactions" on public.transactions for delete to authenticated using (public.is_hca_admin());

-- ============================================================
-- PLAYOFF YEARS
-- ============================================================
create table if not exists public.playoff_years (
  id uuid primary key default gen_random_uuid(),
  season text not null unique,
  display_name text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.playoff_years enable row level security;
drop policy if exists "Public can read playoff years" on public.playoff_years;
create policy "Public can read playoff years" on public.playoff_years for select to anon, authenticated using (enabled = true or public.is_hca_admin());
drop policy if exists "Admins can insert playoff years" on public.playoff_years;
create policy "Admins can insert playoff years" on public.playoff_years for insert to authenticated with check (public.is_hca_admin());
drop policy if exists "Admins can update playoff years" on public.playoff_years;
create policy "Admins can update playoff years" on public.playoff_years for update to authenticated using (public.is_hca_admin()) with check (public.is_hca_admin());
drop policy if exists "Admins can delete playoff years" on public.playoff_years;
create policy "Admins can delete playoff years" on public.playoff_years for delete to authenticated using (public.is_hca_admin());
insert into public.playoff_years(season,display_name) values ('Season 16','Season 16 Playoffs') on conflict(season) do nothing;

-- Tighten the existing bracket policies so only HCA admins can edit them.
drop policy if exists "Admins can insert playoff brackets" on public.playoff_brackets;
create policy "Admins can insert playoff brackets" on public.playoff_brackets for insert to authenticated with check (public.is_hca_admin());
drop policy if exists "Admins can update playoff brackets" on public.playoff_brackets;
create policy "Admins can update playoff brackets" on public.playoff_brackets for update to authenticated using (public.is_hca_admin()) with check (public.is_hca_admin());
drop policy if exists "Admins can delete playoff brackets" on public.playoff_brackets;
create policy "Admins can delete playoff brackets" on public.playoff_brackets for delete to authenticated using (public.is_hca_admin());

-- ============================================================
-- HCA USERS / GM ASSIGNMENTS
-- ============================================================
create table if not exists public.hca_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  role text not null default 'GM',
  team_id text references public.teams(id) on delete set null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hca_users enable row level security;
drop policy if exists "Admins can manage HCA users" on public.hca_users;
create policy "Admins can manage HCA users" on public.hca_users for all to authenticated using (public.is_hca_admin()) with check (public.is_hca_admin());

create or replace function public.admin_upsert_hca_user(p_email text, p_role text, p_team_id text)
returns public.hca_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_row public.hca_users;
begin
  if not public.is_hca_admin() then raise exception 'Not authorized'; end if;
  select id into v_user_id from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  insert into public.hca_users(email,user_id,role,team_id,status,updated_at)
  values(lower(trim(p_email)),v_user_id,upper(p_role),p_team_id,case when v_user_id is null then 'PENDING' else 'ACTIVE' end,now())
  on conflict(email) do update set user_id=excluded.user_id, role=excluded.role, team_id=excluded.team_id, status=excluded.status, updated_at=now()
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.admin_upsert_hca_user(text,text,text) from public;
grant execute on function public.admin_upsert_hca_user(text,text,text) to authenticated;

create or replace function public.link_hca_user_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.hca_users
  set user_id=new.id, status='ACTIVE', updated_at=now()
  where lower(email)=lower(new.email);
  return new;
end;
$$;
drop trigger if exists hca_link_user_after_signup on auth.users;
create trigger hca_link_user_after_signup after insert or update of email on auth.users for each row execute function public.link_hca_user_on_signup();

-- ============================================================
-- ADMIN READ ACCESS TO EVERYTHING NEEDED BY THE PANEL
-- ============================================================
-- Existing public read policies for teams/players/games remain in place.

drop policy if exists "Users can read own HCA access" on public.hca_users;
create policy "Users can read own HCA access" on public.hca_users for select to authenticated using (user_id = auth.uid());
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
