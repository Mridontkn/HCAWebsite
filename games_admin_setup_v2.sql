-- HCA GAME ADMIN SETUP v2
-- Run once in Supabase SQL Editor.

DROP POLICY IF EXISTS "Public can read games" ON public.games;
CREATE POLICY "Public can read games" ON public.games FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "HCA admins can insert games" ON public.games;
CREATE POLICY "HCA admins can insert games" ON public.games FOR INSERT TO authenticated WITH CHECK (public.is_hca_admin());

DROP POLICY IF EXISTS "HCA admins can update games" ON public.games;
CREATE POLICY "HCA admins can update games" ON public.games FOR UPDATE TO authenticated USING (public.is_hca_admin()) WITH CHECK (public.is_hca_admin());

DROP POLICY IF EXISTS "HCA admins can delete games" ON public.games;
CREATE POLICY "HCA admins can delete games" ON public.games FOR DELETE TO authenticated USING (public.is_hca_admin());
