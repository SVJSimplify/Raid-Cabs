# 🚀 Raid Cabs — Deployment Guide

## Recommended Hosts (free to start)

### 1. Vercel ⭐ RECOMMENDED (Zero-config, automatic HTTPS, instant CDN)

```bash
# Install Vercel CLI
npm install -g vercel

# Build
npm run build

# Deploy (first time will ask to login)
vercel

# Set environment variables in Vercel Dashboard:
# Settings → Environment Variables → add all 3 vars
```

Then add this `vercel.json` in the root for the Mappls proxy in production:

```json
{
  "rewrites": [
    {
      "source": "/mappls-api/:path*",
      "destination": "https://apis.mappls.com/:path*"
    }
  ]
}
```

Live URL: `https://raid-cabs.vercel.app`

---

### 2. Netlify (also excellent, drag-and-drop option)

```bash
npm run build
# Drag the /dist folder to netlify.com/drop
```

Or use Netlify CLI:
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

Add `netlify.toml` in root for the Mappls proxy:
```toml
[[redirects]]
  from   = "/mappls-api/*"
  to     = "https://apis.mappls.com/:splat"
  status = 200
  force  = true

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

---

### 3. Cloudflare Pages (fastest globally, free)

```bash
npm run build
# Connect GitHub repo in Cloudflare Pages dashboard
# Build command: npm run build
# Output directory: dist
```

Add a Cloudflare Worker for the Mappls proxy if needed.

---

### 4. Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Public directory: dist
# Single-page app: Yes
npm run build
firebase deploy
```

---

## Environment Variables (set on your host)

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` |
| `VITE_MAPPLS_KEY` | Your Mappls static key |
| `VITE_UPI_ID` | `yourname@upi` (optional) |

---

## Supabase Setup Checklist

1. ✅ Go to **Authentication → Settings**
   - Disable **"Enable email confirmations"**
   - This is the #1 cause of 400 login errors
2. ✅ Run the complete SQL from `src/lib/supabase.js` in **SQL Editor**
3. ✅ Authentication → Providers → **Phone**
   - Add Twilio credentials for OTP
   - Or leave disabled and use Email login
4. ✅ Verify RLS is enabled on all tables (the SQL does this)

---

## Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `400` on login | Email confirmation enabled | Disable in Auth → Settings |
| `500` on query | RLS policy blocking | Run full SQL schema again |
| `401` on query | Auth token expired | User signs out and back in |
| Mappls CORS | Direct API call from browser | Use Vite proxy (already configured) |
| `406` profile | `.single()` on missing row | Fixed — using `.maybeSingle()` |
| Duplicate key warning | Array index as key | Fixed — using unique IDs |

