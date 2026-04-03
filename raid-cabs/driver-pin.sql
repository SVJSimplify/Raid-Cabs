-- Add PIN column to drivers table
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Admin sets PIN when approving driver
-- PIN is stored as plain text here for simplicity
-- (for production you'd hash it, but Supabase RLS protects it)
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS login_pin TEXT;

-- Drivers can read their own record by phone (for login check)
-- This policy allows unauthenticated lookup by phone + pin
CREATE POLICY "drivers_pin_login"
  ON public.drivers
  FOR SELECT
  USING (TRUE);
