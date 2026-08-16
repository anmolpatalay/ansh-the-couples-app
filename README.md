# ANSH

**A private space for two people who are in love and not in the same city.**

Live app: [https://ansh-the-couples-app.onrender.com/](https://ansh-the-couples-app.onrender.com/)

Render's free tier sleeps when idle. The first load can take 30-60 seconds.

## The problem

Long-distance is not only missing someone. It is two clocks, two maps, and no shared home screen.

Anniversaries live in old chats. Photos sit on one phone. "What time is it for you?" happens every evening. Social apps are built for an audience. A couple needs a two-person system: the same data, the same globe, nobody else in the room.

ANSH is that system. Both people share one cloud space so the map, dates, and pictures stay in sync.

## What you can do

- **Find each other.** Sign up with email or Google. Set name, country, city, and photo. Share a pair code or enter theirs. After accept, you are one couple.
- **Globe.** Draggable night earth. Pins with photos, local time, and distance in km. Time comes from NTP, then ticks on the device so the globe does not rebuild every second.
- **Calendar.** Shared dates with emojis. Both can add, edit, and delete. Reminders show when a date is within 7 days.
- **Us in photos.** Shared album, optional notes, click to enlarge. The grid uses thumbnails; the lightbox loads the full image.

Only the paired pair can read or write that couple's calendar and photos.

## How to use it

1. Open https://ansh-the-couples-app.onrender.com/
2. Sign up with email or Continue with Google.
3. Complete name, then country, then city, then photo.
4. Copy your pair code, or enter theirs, and send a pair request.
5. Accept on the other account. You land on the globe.

To test pairing alone, use an incognito window and a second email.

## Why this stands out to recruiters

This is not a login form glued onto CRUD.

- **Pairing is authorization.** A JWT is not enough. Calendar and media require a partner. Shared documents use `couple_key` (sorted user ids) so there is one album and one calendar, not two copies.
- **Auth you can defend in an interview.** Bcrypt passwords. Google ID-token verification (OpenID Connect). Access JWT (30 min) plus refresh JWT (1 day), hashed in Mongo, rotated, and revocable.
- **Time and place are backend problems.** City and country geocode to lat/lng and an IANA timezone. NTP supplies UTC. Geodesic distance is in km. The client ticks locally and resyncs NTP every 15 minutes so WebGL and avatars stay put.
- **Media without a server disk.** Render's filesystem is ephemeral, so images live in MongoDB as BSON binaries. Uploads are compressed; thumbnails are stored separately; the browser caches `<img>` responses.
- **One container to production.** Multi-stage Docker (Node/Vite, then Python/Uvicorn), health checks, env config, GitHub to Render.

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

Guards: `get_current_user` then `require_profile` then `require_paired`.

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
