# ANSH

A private space for two people in a long-distance relationship: a shared globe, a couple calendar, and a photo album.

## What it does

1. **Sign up**, then **log in**. JWT access tokens last **30 minutes**; refresh tokens last **1 day**.
2. After the first login, each person sets **name, city, country, and a profile picture**.
3. ANSH generates a unique **pair code**. Share yours, or enter theirs, then send a **pair request**. The other person accepts.
4. The home page is a **draggable night globe**. Pins show each profile photo, name, city, and the **local time** (NTP time converted to that city’s timezone).
5. **Calendar** stores important dates with small emojis. Dates in the next 7 days show as **in-app reminders**. Add / edit / delete is shared for both of you.
6. **Us in photos** is a shared album. Notes under photos are optional.

Data lives in **MongoDB Atlas**, so both of you read and write the same couple records.

---

## MongoDB Atlas setup

1. Create an account at [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a cluster (the free M0 tier is enough to start).
3. **Database Access** → add a user with password auth (save the password).
4. **Network Access** → allow your IP for local work. For Render, add `0.0.0.0/0` (or Render’s outbound IPs if you lock it down later).
5. **Connect** → Drivers → copy the URI:

```text
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

6. Copy `.env.example` to `.env` and paste that URI. Set `MONGODB_DB=ansh`.
7. You do **not** need to create collections by hand. The API creates indexes on startup.

### Database: `ansh`

| Collection | Purpose |
|---|---|
| `users` | Accounts, profile, pair code, partner link, location |
| `refresh_tokens` | Refresh JWTs (hashed). TTL index deletes them after expiry |
| `pair_requests` | Incoming / outgoing pairing |
| `calendar_events` | Shared dates, keyed by the couple |
| `photos` | Photo metadata |
| `fs.files` / `fs.chunks` | GridFS binaries (profile pictures and album photos) |

### Suggested schema

**users**

```js
{
  _id: ObjectId,
  email: String,              // unique, lowercase
  password_hash: String,
  name: String,
  city: String,
  country: String,
  lat: Number,
  lng: Number,
  timezone: String,           // IANA, e.g. "Asia/Kolkata"
  profile_picture_id: ObjectId, // GridFS
  pair_code: String,          // unique 8-char code
  partner_id: ObjectId,
  profile_complete: Boolean,
  created_at: Date,
  updated_at: Date
}
```

**pair_requests**

```js
{
  _id: ObjectId,
  from_user_id: ObjectId,
  to_user_id: ObjectId,
  from_name: String,
  to_name: String,
  status: "pending" | "accepted" | "rejected" | "cancelled",
  created_at: Date
}
```

**calendar_events**

```js
{
  _id: ObjectId,
  couple_key: String,         // sorted "userId:partnerId"
  title: String,
  event_date: Date,
  emoji: String,
  note: String,
  created_by: ObjectId,
  created_at: Date
}
```

**photos**

```js
{
  _id: ObjectId,
  couple_key: String,
  file_id: ObjectId,          // GridFS
  note: String,               // optional
  created_by: ObjectId,
  created_at: Date
}
```

**refresh_tokens**

```js
{
  _id: ObjectId,
  user_id: ObjectId,
  token_hash: String,         // sha256 of the JWT
  expires_at: Date            // TTL index
}
```

`couple_key` is how both partners share one calendar and one album without duplicating rows.

---

## Run locally (without Docker)

You need Python 3.11+, Node 20+, and a filled-in `.env`.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy ..\.env.example ..\.env
# edit ..\.env with your Atlas URI and JWT_SECRET
$env:MONGODB_URI="..."   # or keep values in .env next to the process
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to the FastAPI server.

---

## Run with Docker

```powershell
copy .env.example .env
# edit .env with Atlas URI and JWT_SECRET
docker compose up --build
```

Open [http://localhost:8000](http://localhost:8000). One container serves the React build and the API.

---

## GitHub

```powershell
git init
git add .
git commit -m "Add ANSH couples app"
gh repo create ansh --private --source=. --remote=origin --push
```

Or create an empty GitHub repo, then:

```powershell
git remote add origin https://github.com/YOUR_USER/ansh.git
git branch -M main
git push -u origin main
```

Do not commit `.env`.

---

## Deploy on Render

1. Push this repo to GitHub.
2. In Render: **New → Web Service → connect the GitHub repo**.
3. Runtime: **Docker**. Health check: `/api/health`.
4. Set environment variables:

| Key | Value |
|---|---|
| `MONGODB_URI` | Atlas connection string |
| `MONGODB_DB` | `ansh` |
| `JWT_SECRET` | long random string |
| `CORS_ORIGINS` | `https://YOUR-SERVICE.onrender.com` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `1` |

5. After the first deploy, copy the Render URL into `CORS_ORIGINS` if it was a placeholder, and redeploy.
6. Atlas **Network Access** must allow Render (`0.0.0.0/0` on the free tier is the usual approach).

`render.yaml` in this repo describes the same service if you use Render Blueprint.

---

## Auth flow

- `POST /api/auth/signup` then `POST /api/auth/login`
- Access JWT: 30 minutes
- Refresh JWT: 1 day, stored hashed, rotated on each refresh
- `POST /api/auth/refresh` with `{ "refresh_token": "..." }`
- `POST /api/users/setup` then optional picture upload
- `POST /api/pairing/request` with the other person’s code
- `POST /api/pairing/decide` to accept or decline
