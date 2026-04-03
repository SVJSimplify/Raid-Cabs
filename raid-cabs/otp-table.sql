-- Run in Supabase → SQL Editor → New Query
-- Creates the table that stores temporary OTPs for driver login

CREATE TABLE IF NOT EXISTS public.driver_otps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT        NOT NULL,
  otp        TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only server (service role) can access this table
-- No RLS policies needed — the serverless function uses service key
ALTER TABLE public.driver_otps ENABLE ROW LEVEL SECURITY;

-- No user-facing policies — all access via service role in API functions

-- Auto-cleanup expired OTPs (optional — keeps table small)
CREATE OR REPLACE FUNCTION public.fn_cleanup_otps()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.driver_otps
  WHERE expires_at < NOW() - INTERVAL '1 hour'
     OR used = TRUE;
$$;
