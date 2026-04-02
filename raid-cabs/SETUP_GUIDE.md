# 🚖 Raid Cabs — Complete Setup Guide

## Step 1 — Create Supabase Project

1. Go to **https://supabase.com** → Sign up (free)
2. Click **"New project"**
   - Name: `raid-cabs`
   - Database password: save it somewhere safe
   - Region: **Southeast Asia (Singapore)** — closest to Hyderabad
3. Wait ~2 minutes for the project to be ready

---

## Step 2 — Disable Email Confirmation ⚠️ CRITICAL

Without this, every login returns **400 error**.

1. Supabase Dashboard → **Authentication** → **Settings**
2. Scroll to **"User Signups"**
3. Toggle OFF → **"Enable email confirmations"**
4. Click **Save**

---

## Step 3 — Get Your API Keys

1. Supabase Dashboard → **Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** → paste as `VITE_SUPABASE_URL`
   - **anon / public key** → paste as `VITE_SUPABASE_ANON_KEY`

---

## Step 4 — Run the SQL Schema

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Copy the ENTIRE SQL block from `src/lib/supabase.js` (everything between the `===` lines)
3. Paste it and click **Run** (green button)
4. You should see: `Success. No rows returned`
5. If you see errors, run it a **second time** — some `DROP IF EXISTS` statements need the first run

---

## Step 5 — Enable Phone OTP (Optional — for SMS login)

If you want Phone OTP login:
1. Sign up at **https://twilio.com** (free trial gives $15 credit)
2. Get: Account SID, Auth Token, and a phone number
3. Supabase → **Authentication** → **Providers** → **Phone**
4. Enable it → paste Twilio credentials → Save
5. If you skip this, use **Email login** — it works without Twilio

---

## Step 6 — Get Mappls API Key

1. Go to **https://auth.mappls.com/console** → Sign up (free)
2. Create a project → Go to **API Keys**
3. Copy your **Static / Map SDK key**
4. Paste as `VITE_MAPPLS_KEY` in your `.env`

---

## Step 7 — Configure Environment Variables

Create a file called `.env` in the `raid-cabs` folder (same level as `package.json`):

```env
VITE_SUPABASE_URL=https://abcdefghij.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxx
VITE_MAPPLS_KEY=yourmapplskeyhere
VITE_UPI_ID=yourupiid@upi
```

---

## Step 8 — Install & Run

```bash
cd raid-cabs
npm install --legacy-peer-deps
npm run dev
```

Open **http://localhost:5173**

---

## Step 9 — Create Your First Admin Account

1. Open the app → **Sign In** tab → **Email** method → **Register**
2. Create an account with your email
3. Go to Supabase → **Table Editor** → **profiles**
4. Find your row → click Edit → change `role` from `user` to `admin`
5. Sign out and back in → you'll see the **Admin** option

---

## Step 10 — Deploy to Vercel (Production)

```bash
npm install -g vercel
npm run build
vercel
```

In Vercel Dashboard → your project → **Settings** → **Environment Variables** → add all 4 variables.

The `vercel.json` file is already included — it handles:
- Mappls CORS proxy (`/mappls-api/*` → `apis.mappls.com`)
- SPA routing (all routes → `/index.html`)
- Security headers
- Asset caching

---

## Troubleshooting Common Errors

| Error | Fix |
|---|---|
| `400` on login | Disable email confirmation in Supabase → Auth → Settings |
| `500` on any query | Re-run the SQL schema; check table/column names |
| `406` on profile | Fixed — using `maybeSingle()` instead of `single()` |
| Mappls CORS blocked | In dev: Vite proxy handles it. In prod: `vercel.json` rewrite handles it |
| `relation does not exist` | Run the SQL schema first |
| `new row violates row-level security` | Run the SQL — RLS policies need `WITH CHECK` |
| Phone OTP `provider not enabled` | Enable Phone in Supabase Auth → Providers with Twilio |
| Duplicate key React warning | Fixed — all lists use unique IDs |

