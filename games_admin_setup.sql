-- HCA GAME ADMIN SETUP
-- Run this once in Supabase SQL Editor after the existing admin_setup.sql.
-- Public/authenticated users can continue reading games.
-- Only users listed in public.admin_users with role='admin' can insert/update games.

DROP POLICY IF EXISTS "Public can read games" ON public.games;
CREATE POLICY "Public can read games"
ON public.games
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "HCA admins can insert games" ON public.games;
CREATE POLICY "HCA admins can insert games"
ON public.games
FOR INSERT
TO authenticated
WITH CHECK (public.is_hca_admin());

DROP POLICY IF EXISTS "HCA admins can update games" ON public.games;
CREATE POLICY "HCA admins can update games"
ON public.games
FOR UPDATE
TO authenticated
USING (public.is_hca_admin())
WITH CHECK (public.is_hca_admin());
