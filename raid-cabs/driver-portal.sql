-- Run this in Supabase SQL Editor after your main schema

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_drivers_auth_user_id ON public.drivers(auth_user_id);

DROP POLICY IF EXISTS "drivers_select_approved" ON public.drivers;
DROP POLICY IF EXISTS "drivers_read_own"        ON public.drivers;
DROP POLICY IF EXISTS "drivers_update_own"      ON public.drivers;
DROP POLICY IF EXISTS "bookings_driver_read"    ON public.bookings;
DROP POLICY IF EXISTS "bookings_driver_update"  ON public.bookings;
DROP POLICY IF EXISTS "drivers_link_own"        ON public.drivers;

CREATE POLICY "drivers_select_approved"
  ON public.drivers FOR SELECT
  USING (is_approved = TRUE OR public.fn_is_admin());

CREATE POLICY "drivers_read_own"
  ON public.drivers FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "drivers_link_own"
  ON public.drivers FOR UPDATE
  USING (
    phone = (
      SELECT phone FROM auth.users WHERE id = auth.uid()
    )
    OR auth_user_id = auth.uid()
    OR public.fn_is_admin()
  )
  WITH CHECK (
    phone = (
      SELECT phone FROM auth.users WHERE id = auth.uid()
    )
    OR auth_user_id = auth.uid()
    OR public.fn_is_admin()
  );

CREATE POLICY "drivers_update_own"
  ON public.drivers FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "bookings_driver_read"
  ON public.bookings FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "bookings_driver_update"
  ON public.bookings FOR UPDATE
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    driver_id IN (
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'drivers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
  END IF;
END;
$$;
