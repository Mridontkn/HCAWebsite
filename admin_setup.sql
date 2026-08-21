-- HCA ADMIN SETUP
-- Run this once in the Supabase SQL Editor.
-- This gives only users explicitly listed in admin_users permission to modify players.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create or replace function public.is_hca_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_hca_admin() from public;
grant execute on function public.is_hca_admin() to anon, authenticated;

-- Add the HCA admin account created during setup.
insert into public.admin_users (user_id, role)
select id, 'admin'
from auth.users
where email = 'admin@hca.com'
on conflict (user_id) do update set role = excluded.role;

-- Keep public data readable by both logged-out and logged-in visitors.
-- These are SELECT-only policies.
drop policy if exists "Public can read players" on public.players;
create policy "Public can read players"
on public.players
for select
to anon, authenticated
using (true);

-- Admin-only player writes.
drop policy if exists "HCA admins can insert players" on public.players;
create policy "HCA admins can insert players"
on public.players
for insert
to authenticated
with check (public.is_hca_admin());

drop policy if exists "HCA admins can update players" on public.players;
create policy "HCA admins can update players"
on public.players
for update
to authenticated
using (public.is_hca_admin())
with check (public.is_hca_admin());

-- Optional: verify the current admin was added.
select au.user_id, au.role, u.email
from public.admin_users au
join auth.users u on u.id = au.user_id
where u.email = 'admin@hca.com';
