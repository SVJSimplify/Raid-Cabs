# 🚖 Raid Cabs PWA

> **Our Wheels Take You To Fly**

A full-featured Progressive Web App for Raid Cabs — a premium campus cab service connecting IIT routes.

---

## 🗂 Project Structure

```
raid-cabs/
├── src/
│   ├── pages/
│   │   ├── Login.jsx           ← Sign in / Register (public)
│   │   ├── Dashboard.jsx       ← Home: Deposit or Book options
│   │   ├── Deposit.jsx         ← QR code UPI payment + concession
│   │   ├── BookCab.jsx         ← Live tracking + driver ETA + fare
│   │   ├── Admin.jsx           ← Admin panel (discounts, drivers, bookings)
│   │   ├── DriverSignup.jsx    ← New driver registration page
│   │   └── EmergencyDriver.jsx ← Emergency driver creation
│   ├── components/
│   │   ├── Navbar.jsx
│   │   └── ProtectedRoute.jsx
│   ├── contexts/AuthContext.jsx
│   └── lib/supabase.js         ← Supabase client + full SQL schema (commented)
├── public/logo.png
├── .env.example
└── vite.config.js              ← PWA config included
```

---

## ⚡ Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Set up Supabase
- Create a project at [supabase.com](https://supabase.com)
- Open the SQL Editor and run the full schema from `src/lib/supabase.js` (the big comment block)
- Copy your `Project URL` and `anon public key` to `.env`

### 4. (Optional) Google Maps
- Get an API key from [Google Cloud Console](https://console.cloud.google.com)
- Enable **Maps JavaScript API** and **Directions API**
- Add it to `.env` as `VITE_GOOGLE_MAPS_API_KEY`

### 5. Run locally
```bash
npm run dev
```

### 6. Build for production
```bash
npm run build
# Deploy the /dist folder to Vercel, Netlify, or any static host
```

---

## 🔐 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional | For live GPS map tracking |

---

## 🌐 Pages & Routes

| Route | Access | Description |
|---|---|---|
| `/login` | Public | Login + Register |
| `/driver-signup` | Public | Driver registration |
| `/dashboard` | User | Main hub — Deposit or Book |
| `/deposit` | User | QR code deposit + discount tiers |
| `/book` | User | Book a cab with live map |
| `/admin` | Admin only | Full admin panel |
| `/emergency-driver` | Admin only | Emergency driver creation |

---

## 🛠 Admin Panel Features

- **Discounts tab** — Add / edit / delete concession tiers (₹ range → discount %)
- **Deposits tab** — Approve pending deposits, auto-apply discounts
- **Drivers tab** — View/manage all drivers, change status, assign/remove
- **Bookings tab** — See all bookings, assign drivers manually
- **Users tab** — View all users, promote to admin

### Making someone an Admin
1. Go to `/admin` → Users tab
2. Change their role dropdown from `user` → `admin`

---

## 📱 PWA Installation

On mobile, tap **"Add to Home Screen"** in the browser menu.  
On desktop Chrome, click the install icon in the address bar.

---

## 🧩 Tech Stack

- **React 19** + **Vite 8**
- **Supabase** — Auth, Postgres, Row Level Security
- **React Router DOM** — Client-side routing
- **vite-plugin-pwa** — Service worker + offline support
- **qrcode.react** — UPI QR generation
- **lucide-react** — Icons
- **react-hot-toast** — Notifications
- **Google Maps JS API** — Live driver tracking

---

## 🚀 Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
# Set env vars in Vercel dashboard
```

