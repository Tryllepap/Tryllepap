# TryllePap 🃏

> The card game of magic and trickery.

A Next.js web application for the **TryllePap** card game. Currently includes:
- Dark fantasy main menu screen
- Username + password authentication (no OAuth)
- HTTP-only session cookies via `iron-session`
- Per-user `gameData` storage (ready for future game features)
- Persistent user storage via **Vercel KV** (Redis), with an in-memory fallback for local dev

---

## Tech Stack

| Layer        | Technology                      |
|--------------|---------------------------------|
| Framework    | Next.js 14 (App Router)         |
| Auth         | `iron-session` + `bcryptjs`     |
| Database     | Vercel KV (Redis)               |
| Deployment   | Vercel                          |
| Fonts        | Cinzel + IM Fell English        |

---

## Local Development

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/tryllepap.git
cd tryllepap
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.local.example .env.local
```

Open `.env.local` and set `SESSION_SECRET` to a long random string. Generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

KV vars are optional for local dev — the app uses an in-memory store automatically if absent. Data won't persist between server restarts, but it's fine for testing.

### 4. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

### 1. Push to GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Import to Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Framework is auto-detected as **Next.js** — no changes needed

### 3. Add Vercel KV
In your Vercel project dashboard:
1. Go to **Storage → Create Database → KV**
2. Name it `tryllepap-db` and click **Create**
3. Vercel automatically adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your environment variables

### 4. Add SESSION_SECRET
In **Settings → Environment Variables**, add:

| Key              | Value                         |
|------------------|-------------------------------|
| `SESSION_SECRET` | A random 32+ character string |

### 5. Deploy
Vercel deploys automatically on every push to `main`. 🎉

---

## Project Structure
