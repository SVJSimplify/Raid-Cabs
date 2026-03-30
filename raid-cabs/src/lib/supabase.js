import { createClient } from '@supabase/supabase-js'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL    || 'https://your-project.supabase.co'
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/* ─── Safe query wrapper ────────────────────────────────────────────────────
   Wraps any supabase call, catches network errors, logs 500s cleanly.
   Usage: const { data, error } = await q(() => supabase.from(...).select())
──────────────────────────────────────────────────────────────────────────── */
export async function q(fn) {
  try {
    const result = await fn()
    if (result?.error) {
      console.error('[Supabase]', result.error.code, result.error.message, result.error.details)
    }
    return result ?? { data: null, error: { message: 'No response' } }
  } catch (err) {
    console.error('[Supabase network]', err)
    return { data: null, error: { message: err?.message || 'Network error' } }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPLETE SQL SCHEMA — Copy everything between the START and END markers
   and paste into Supabase → SQL Editor → New Query → Run
   ══════════════════════════════════════════════════════════════════════════

-- ████████████████████████  RAID CABS SCHEMA  ████████████████████████████
-- Run this in Supabase SQL Editor. Safe to re-run (idempotent).
-- BEFORE running: Auth → Settings → Disable "Enable email confirmations"
-- ─────────────────────────────────────────────────────────────────────────

-- ── EXTENSIONS ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── DROP OLD TRIGGERS FIRST (prevents conflicts on re-run) ───────────────
DROP TRIGGER IF EXISTS trg_receipt        ON bookings;
DROP TRIGGER IF EXISTS trg_driver_rating  ON bookings;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ── SEQUENCES ────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS receipt_seq START WITH 1000 INCREMENT BY 1;

-- ── TABLES ───────────────────────────────────────────────────────────────

-- profiles: extends auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name        TEXT,
  phone            TEXT,
  role             TEXT        NOT NULL DEFAULT 'user',
  balance          NUMERIC     NOT NULL DEFAULT 0,
  discount_percent NUMERIC     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- drivers
CREATE TABLE IF NOT EXISTS drivers (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  phone          TEXT        NOT NULL,
  rating         NUMERIC     NOT NULL DEFAULT 5.0,
  total_ratings  INTEGER     NOT NULL DEFAULT 0,
  vehicle_number TEXT,
  vehicle_model  TEXT        NOT NULL DEFAULT 'Toyota Innova',
  status         TEXT        NOT NULL DEFAULT 'available',
  is_emergency   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint on driver phone only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_phone_key'
  ) THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_phone_key UNIQUE (phone);
  END IF;
END $$;

-- discount_tiers
CREATE TABLE IF NOT EXISTS discount_tiers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  min_amount       NUMERIC     NOT NULL,
  max_amount       NUMERIC,
  discount_percent NUMERIC     NOT NULL,
  label            TEXT        NOT NULL,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- bookings
CREATE TABLE IF NOT EXISTS bookings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number      TEXT        UNIQUE,
  user_id             UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  driver_id           UUID        REFERENCES drivers(id) ON DELETE SET NULL,
  pickup_address      TEXT        NOT NULL,
  pickup_lat          NUMERIC,
  pickup_lng          NUMERIC,
  drop_address        TEXT        NOT NULL DEFAULT 'IIT Hyderabad, Sangareddy',
  drop_lat            NUMERIC,
  drop_lng            NUMERIC,
  distance_km         NUMERIC,
  base_fare           NUMERIC,
  discount_amount     NUMERIC     NOT NULL DEFAULT 0,
  final_fare          NUMERIC,
  status              TEXT        NOT NULL DEFAULT 'pending',
  eta_pickup          TEXT,
  eta_drop            TEXT,
  user_rating         INTEGER,
  user_review         TEXT,
  rated_at            TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- deposits
CREATE TABLE IF NOT EXISTS deposits (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount           NUMERIC     NOT NULL,
  discount_applied NUMERIC     NOT NULL DEFAULT 0,
  payment_ref      TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending',
  approved_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  rejected_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_user_id    ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver_id  ON bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created    ON bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_user_id    ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status     ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_drivers_status      ON drivers(status);

-- ── TRIGGER FUNCTIONS ──────────────────────────────────────────────────────

-- 1. Auto-generate receipt number
CREATE OR REPLACE FUNCTION fn_set_receipt()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.receipt_number := 'RC-' || LPAD(NEXTVAL('receipt_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_receipt
  BEFORE INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.receipt_number IS NULL)
  EXECUTE FUNCTION fn_set_receipt();

-- 2. Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, NULL)
  )
  ON CONFLICT (id) DO UPDATE
    SET
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      phone     = COALESCE(EXCLUDED.phone, profiles.phone),
      updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();

-- 3. Recalculate driver rating when a booking is rated
CREATE OR REPLACE FUNCTION fn_recalc_driver_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL THEN
    UPDATE drivers SET
      rating = (
        SELECT ROUND(AVG(user_rating)::NUMERIC, 1)
        FROM bookings
        WHERE driver_id = NEW.driver_id AND user_rating IS NOT NULL
      ),
      total_ratings = (
        SELECT COUNT(*)
        FROM bookings
        WHERE driver_id = NEW.driver_id AND user_rating IS NOT NULL
      )
    WHERE id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_driver_rating
  AFTER UPDATE OF user_rating ON bookings
  FOR EACH ROW
  WHEN (NEW.user_rating IS NOT NULL AND NEW.driver_id IS NOT NULL)
  EXECUTE FUNCTION fn_recalc_driver_rating();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────

-- Enable RLS
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits       ENABLE ROW LEVEL SECURITY;

-- !! Drop all existing policies to avoid conflicts !!
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles','drivers','discount_tiers','bookings','deposits')
  ) LOOP
    EXECUTE FORMAT('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Helper function: is current user an admin?
-- Uses SECURITY DEFINER to avoid infinite recursion
CREATE OR REPLACE FUNCTION fn_is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── PROFILES policies ──────────────────────────────────────────────────────
-- Users can read/update their own profile
CREATE POLICY "profiles: users read own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: users update own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-insert on signup (needed for the trigger to work)
CREATE POLICY "profiles: insert own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins can do everything
CREATE POLICY "profiles: admin all"
  ON profiles FOR ALL
  USING (fn_is_admin())
  WITH CHECK (fn_is_admin());

-- ── DRIVERS policies ───────────────────────────────────────────────────────
-- Anyone logged in can read drivers (needed to show available drivers)
CREATE POLICY "drivers: authenticated read"
  ON drivers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can write drivers
CREATE POLICY "drivers: admin write"
  ON drivers FOR INSERT
  WITH CHECK (fn_is_admin());

CREATE POLICY "drivers: admin update"
  ON drivers FOR UPDATE
  USING (fn_is_admin())
  WITH CHECK (fn_is_admin());

CREATE POLICY "drivers: admin delete"
  ON drivers FOR DELETE
  USING (fn_is_admin());

-- ── DISCOUNT TIERS policies ────────────────────────────────────────────────
-- Public read (unauthenticated users see tiers on deposit page)
CREATE POLICY "tiers: public read"
  ON discount_tiers FOR SELECT
  USING (TRUE);

CREATE POLICY "tiers: admin write"
  ON discount_tiers FOR INSERT
  WITH CHECK (fn_is_admin());

CREATE POLICY "tiers: admin update"
  ON discount_tiers FOR UPDATE
  USING (fn_is_admin())
  WITH CHECK (fn_is_admin());

CREATE POLICY "tiers: admin delete"
  ON discount_tiers FOR DELETE
  USING (fn_is_admin());

-- ── BOOKINGS policies ──────────────────────────────────────────────────────
CREATE POLICY "bookings: users read own"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "bookings: users insert own"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookings: users update own"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookings: admin all"
  ON bookings FOR ALL
  USING (fn_is_admin())
  WITH CHECK (fn_is_admin());

-- ── DEPOSITS policies ──────────────────────────────────────────────────────
CREATE POLICY "deposits: users read own"
  ON deposits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "deposits: users insert own"
  ON deposits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deposits: admin all"
  ON deposits FOR ALL
  USING (fn_is_admin())
  WITH CHECK (fn_is_admin());

-- ── SEED DATA ─────────────────────────────────────────────────────────────
-- Truncate and re-seed tiers (safe to re-run)
DELETE FROM discount_tiers WHERE TRUE;

INSERT INTO discount_tiers (min_amount, max_amount, discount_percent, label, sort_order) VALUES
  (5000,  9999,  10, '🥈 Silver — 10% off',   1),
  (10000, 24999, 15, '🥇 Gold — 15% off',     2),
  (25000, 49999, 20, '🏆 Platinum — 20% off', 3),
  (50000, NULL,  25, '💎 Diamond — 25% off',  4);

-- ████████████████████████  END OF SCHEMA  ████████████████████████████████
══════════════════════════════════════════════════════════════════════════ */
