# ANSH

A shared space for two people in a long-distance relationship: one map, one calendar, one photo album, paired to exactly one other account.

Live app: [https://ansh-the-couples-app.onrender.com/](https://ansh-the-couples-app.onrender.com/)

Render's free tier sleeps when idle. The first load can take 30–60 seconds.

## What it does

- **Pairing.** Sign up with email or Google. Set name, country, city, and photo. Share a pair code or enter theirs. Once accepted, the two accounts are linked and all shared data is scoped to that pair.
- **Globe.** Draggable night earth. Pins show each partner's photo, local time, and distance in km. Time comes from NTP and ticks locally on the device so the globe doesn't re-render every second.
- **Calendar.** Shared dates with emojis. Either partner can add, edit, or delete. Dates within 7 days surface as reminders.
- **Photos.** Shared album with optional notes. Grid uses thumbnails; clicking an image loads the full-resolution version.

Calendar and photo data are readable/writable only by the paired accounts.

## How to use it

1. Open https://ansh-the-couples-app.onrender.com/
2. Sign up with email or Continue with Google.
3. Complete name, then country, then city, then photo.
4. Copy your pair code, or enter theirs, and send a pair request.
5. Accept on the other account. You land on the globe.

To test pairing solo, use an incognito window with a second email.

## Design notes

- **Pairing is an authorization boundary, not just a relationship.** A valid JWT alone doesn't grant access to calendar or photo endpoints — the request also has to belong to a paired user. Shared documents use a `couple_key` (sorted pair of user ids) so each couple has exactly one calendar and one album, not one per user.
- **Auth:** bcrypt for passwords, Google ID-token verification via OpenID Connect, short-lived access JWT (30 min) plus a refresh JWT (1 day) that's hashed in Mongo, rotated, and revocable.
- **Time/geo:** city and country are geocoded to lat/lng and an IANA timezone. NTP supplies UTC server-side; the client ticks locally and resyncs every 15 minutes so the globe and clocks don't drift or jump.
- **Media storage:** Render's filesystem is ephemeral, so images are stored as BSON binaries in MongoDB rather than on disk. Uploads are compressed on write; thumbnails are stored separately from full images.
- **Deployment:** multi-stage Docker build (Node/Vite for the frontend, Python/Uvicorn for the backend) into a single container, with health checks, env-based config, and GitHub → Render deploy.

## Tech stack

| Layer | Choice | Why it is there |
|---|---|---|
| API | FastAPI (async), Uvicorn | Typed routes, OpenAPI `/docs`, dependency injection for auth |
| Runtime | Python 3.12 in production | Async Mongo, Pillow, geo and NTP libraries |
| Auth | JWT (python-jose), bcrypt, Google Identity Services | Access + refresh; Google ID token verified with google-auth |
| Data | MongoDB Atlas, PyMongo async | One cloud DB both partners hit |
| Images | Atlas `blobs`, Pillow | Compress and thumbnail on write |
| Time / geo | ntplib, geopy, timezonefinder, tzdata | NTP, geocoding, timezones, distance |
| Frontend | React 18, Vite, Three.js | SPA and a custom WebGL globe |
| Setup UI | country-state-city | Country dropdown, then city dropdown |
| Ship | Docker multi-stage, Render, GitHub | Reproducible deploy |

```
Browser  -->  FastAPI  (/api + built React SPA)
                 |
           MongoDB Atlas
           users, pair_requests, calendar_events, photos, blobs, refresh_tokens
```

## API surface

- Auth: `POST /api/auth/signup` `login` `google` `refresh` `logout`, `GET /api/auth/config`
- Profile: `GET /api/users/me`, `POST /api/users/setup`, picture upload
- Pairing: `GET /api/pairing/status`, `POST /api/pairing/request`, `POST /api/pairing/decide`
- Home: `GET /api/home/map` (pins, NTP, distance, reminders), `GET /api/home/clock`
- Calendar: `GET/POST /api/calendar`, `PUT/DELETE /api/calendar/{id}`
- Photos: `GET/POST /api/photos`, thumb and file, `DELETE`

Route guards, applied in order: `get_current_user` → `require_profile` → `require_paired`.

API docs: https://ansh-the-couples-app.onrender.com/docs
Authorize with the access JWT from login (`eyJ...`), not the pair code.

## Data (database `ansh`)

| Collection | Role |
|---|---|
| `users` | Email, password hash and/or `google_id`, profile, lat/lng, timezone, pair code, `partner_id` |
| `refresh_tokens` | SHA-256 of refresh JWT; TTL on expiry |
| `pair_requests` | pending / accepted / rejected / cancelled |
| `calendar_events` | Shared dates via `couple_key` |
| `photos` | Metadata, `file_id`, `thumb_id` |
| `blobs` | Full image and thumbnail bytes |

## Local development

Python 3.11+, Node 20+, `.env` from `.env.example`. Do not commit `.env`.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (Vite proxies `/api` to port 8000).

Google sign-in: Web OAuth client in Google Cloud. JavaScript origins are origin only (no `/signup` path): `http://localhost:5173` and `https://ansh-the-couples-app.onrender.com`. Set `GOOGLE_CLIENT_ID`.

## Deploy

The app is already on Render from this repo's Dockerfile. Push `main` to redeploy.

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas URI (`@` in the password as `%40`) |
| `MONGODB_DB` | `ansh` |
| `JWT_SECRET` | Long random string |
| `CORS_ORIGINS` | `https://ansh-the-couples-app.onrender.com` |
| `GOOGLE_CLIENT_ID` | Google Web client ID |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `1` |

Atlas Network Access must allow Render (often `0.0.0.0/0` on the free cluster).