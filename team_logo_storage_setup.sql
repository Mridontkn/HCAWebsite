-- HCA TEAM LOGO STORAGE SETUP
-- Run this once in Supabase SQL Editor.
-- Requires the HCA v12 setup to already be installed.

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "HCA admins can upload team logos" on storage.objects;
create policy "HCA admins can upload team logos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'team-logos' and public.is_hca_admin());

drop policy if exists "HCA admins can update team logos" on storage.objects;
create policy "HCA admins can update team logos"
on storage.objects for update
to authenticated
using (bucket_id = 'team-logos' and public.is_hca_admin())
with check (bucket_id = 'team-logos' and public.is_hca_admin());

drop policy if exists "HCA admins can delete team logos" on storage.objects;
create policy "HCA admins can delete team logos"
on storage.objects for delete
to authenticated
using (bucket_id = 'team-logos' and public.is_hca_admin());
