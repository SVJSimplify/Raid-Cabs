-- Generic OTP table for both passengers and drivers
-- Run in Supabase → SQL Editor → New Query

CREATE TABLE IF NOT EXISTS public.otp_codes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT        NOT NULL,
  otp        TEXT        NOT NULL,
  user_type  TEXT        NOT NULL DEFAULT 'user',  -- 'user' or 'driver'
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Only service role (server) can access — no client policies needed
-- Cleanup index for expiry
CREATE INDEX IF NOT EXISTS idx_otp_phone_type ON public.otp_codes (phone, user_type);

-- Drop old driver_otps table if it exists from previous setup
DROP TABLE IF EXISTS public.driver_otps;
