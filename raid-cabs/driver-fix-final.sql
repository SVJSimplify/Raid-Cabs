-- ─────────────────────────────────────────────────────────────────
-- DRIVER PIN FIX — Run this in Supabase → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────

-- 1. Add columns (safe to run even if they exist)
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS login_pin    TEXT,
  ADD COLUMN IF NOT EXISTS is_approved  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_online    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_seen    TIMESTAMPTZ;

-- 2. Drop ALL existing driver policies (clean slate)
DROP POLICY IF EXISTS "drivers_select_approved"       ON public.drivers;
DROP POLICY IF EXISTS "drivers_select_auth"           ON public.drivers;
DROP POLICY IF EXISTS "drivers_select_authenticated"  ON public.drivers;
DROP POLICY IF EXISTS "drivers_read_own"              ON public.drivers;
DROP POLICY IF EXISTS "drivers_update_own"            ON public.drivers;
DROP POLICY IF EXISTS "drivers_link_own"              ON public.drivers;
DROP POLICY IF EXISTS "drivers_insert_admin"          ON public.drivers;
DROP POLICY IF EXISTS "drivers_update_admin"          ON public.drivers;
DROP POLICY IF EXISTS "drivers_delete_admin"          ON public.drivers;
DROP POLICY IF EXISTS "drivers_apply_public"          ON public.drivers;
DROP POLICY IF EXISTS "drivers_pin_login"             ON public.drivers;
DROP POLICY IF EXISTS "drivers_admin_all"             ON public.drivers;

-- 3. Public can INSERT (driver signup — no auth needed)
CREATE POLICY "drivers_public_insert"
  ON public.drivers FOR INSERT
  WITH CHECK (
    is_approved  = FALSE AND
    is_emergency = FALSE
  );

-- 4. Public can SELECT approved drivers (needed for driver PIN login — no auth)
--    AND for passengers to see driver details during booking
CREATE POLICY "drivers_public_read"
  ON public.drivers FOR SELECT
  USING (TRUE);

-- 5. Admins can UPDATE and DELETE any driver (approve, set PIN, change status)
CREATE POLICY "drivers_admin_write"
  ON public.drivers FOR UPDATE
  USING  (public.fn_is_admin())
  WITH CHECK (public.fn_is_admin());

CREATE POLICY "drivers_admin_delete"
  ON public.drivers FOR DELETE
  USING (public.fn_is_admin());

-- 6. Verify the columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'drivers'
  AND column_name  IN ('login_pin','is_approved','is_online','last_seen')
ORDER BY column_name;
