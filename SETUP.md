# adkerala — Setup & Development Guide

## Project structure

```
adkeralav0/
├── packages/types/        Shared TypeScript types
├── packages/utils/        Shared utilities (haversine, GPS buffer, etc.)
├── apps/web/              Next.js 15 — admin portal, driver PWA, display page, API, Socket.IO
├── apps/electron/         Display kiosk (Electron) — local WS, mDNS, SQLite
├── esp32/                 PlatformIO firmware for the 3-button controller
└── prisma/                PostgreSQL schema + seed (14 Kerala districts)
```

---

## 1. Prerequisites

- Node.js ≥ 20, npm ≥ 10
- PostgreSQL 15+ (or use Railway's plugin)
- Redis (or use Railway's plugin)
- (Optional) Google Cloud service account for Malayalam TTS
- (Optional) Cloudflare R2 bucket for media

---

## 2. First-time setup

```bash
# Clone / open the folder, then:
cp .env.example .env
# Fill in DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET, etc.

npm install              # installs all workspaces
npm run db:generate      # prisma generate
npm run db:migrate       # run migrations (creates all tables)
npm run db:seed          # seed 14 districts + platform admin account
```

Default admin login: **admin@adkerala.in / admin123**
> Change the password immediately in production!

---

## 3. Run locally

```bash
npm run dev              # starts Next.js + Socket.IO server on :3000
```

- Admin portal:  http://localhost:3000/admin
- Driver PWA:    http://localhost:3000/driver
- Display page:  http://localhost:3000/display

---

## 4. Deploy to Railway

1. Push this repo to GitHub
2. New Railway project → Deploy from GitHub
3. Add **PostgreSQL** plugin → copy `DATABASE_URL` to env
4. Add **Redis** plugin → copy `REDIS_URL` to env
5. Set all other env vars (see `.env.example`)
6. Railway uses `railway.toml` automatically — build + migrate + start

---

## 5. Electron display app (bus PC)

```bash
cd apps/electron
npm install
npm run dev            # dev mode
npm run dist           # package for Windows/Linux
```

On first run, open the setup page to configure:
- `busId` — the bus ID from the admin portal
- `displayToken` — generated when you create the bus
- `cloudUrl` — your Railway URL

Or configure via the Electron `electron-store` (NVS equivalent).

---

## 6. Driver PWA (driver phone)

1. Open `https://your-railway-url.up.railway.app/driver` in Chrome on Android
2. Tap **Add to Home Screen**
3. Open the app — it runs fullscreen, screen never sleeps (Wake Lock API)
4. Login with driver credentials → enter 6-digit pairing code shown on display

**GPS always-on:** the `useGps` hook uses `navigator.geolocation.watchPosition` with `enableHighAccuracy: true` and `Screen Wake Lock` so the screen never turns off and GPS never pauses.

Offline GPS points are queued in IndexedDB and flushed to the cloud socket on reconnect.

---

## 7. ESP32 firmware

**Hardware wiring:**
| Button   | GPIO |
|----------|------|
| Forward  | 12   |
| Undo     | 14   |
| Announce | 27   |
| LED      | 2    |

All buttons are normally-open, connected between GPIO and GND. Internal pull-ups enabled.

**Flash:**
```bash
cd esp32
# Install PlatformIO CLI or use VS Code PlatformIO extension
pio run --target upload
```

**First-time WiFi config** (send via Serial Monitor at 115200 baud):
```
SET wifi_ssid=BusRouterSSID|wifi_pass=BusRouterPass|device_token=my-secret
```
The ESP32 saves to NVS and restarts.

**What it does:**
- Connects to the bus WiFi router (SIM card router, not internet)
- Finds `adkerala-display.local:8765` via mDNS
- Sends `{ type: "btn", button: "forward"|"undo"|"announce", token: "..." }` on each press
- Heartbeat every 10 s, reconnects every 2 s on drop
- Never touches the internet

---

## 8. Bus WiFi router setup

Every bus needs a 4G/SIM-card WiFi router. Configure it with:
- SSID: `adkerala-<bus-plate>` (or any name)
- Same credentials stored in ESP32 NVS and Electron config
- All 3 devices (display PC, driver phone, ESP32) connect to this router

The router provides both:
1. Local LAN (always works — offline from internet)
2. Internet (when SIM signal available — for cloud sync, new ads, admin live map)

---

## 9. Key environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `NEXTAUTH_SECRET` | 32+ char random string for JWT signing |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET` | R2 bucket name |
| `R2_PUBLIC_URL` | Public base URL for media (e.g. `https://media.adkerala.in`) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public token for fleet map |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCloud service account JSON (TTS) |

---

## 10. Revenue model recap

- `revenue_config` singleton in DB: `defaultAdvertiserCpm` (₹20) and `defaultOwnerCpm` (₹12)
- Platform margin = 20 − 12 = **₹8 per 1000 impressions**
- Each impression is logged with exact CPM values at time of play (not retroactive)
- Bus owners see their running balance at `/admin/revenue`
- Payout requests go to platform admin for processing
