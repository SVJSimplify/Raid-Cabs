-- Safety features SQL
-- Run in Supabase → SQL Editor → New Query

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS emergency_contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS share_location          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS safety_pin              TEXT;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS sos_triggered    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sos_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_safe     BOOLEAN,
  ADD COLUMN IF NOT EXISTS share_token      TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID        REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  driver_id    UUID        REFERENCES public.drivers(id)  ON DELETE SET NULL,
  triggered_by TEXT        NOT NULL DEFAULT 'passenger',
  message      TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  resolved     BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sos_insert_own"
  ON public.sos_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sos_select_own"
  ON public.sos_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "sos_admin"
  ON public.sos_alerts FOR ALL
  USING (public.fn_is_admin())
  WITH CHECK (public.fn_is_admin());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sos_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
  END IF;
END;
$$;
