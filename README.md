# Card Game

A multiplayer card game web app built with Next.js. This is **Step 1** — the auth + onboarding foundation.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth.js v4 (Email / magic-link) |
| Database | SQLite via `better-sqlite3` (local) |
| Styling | Tailwind CSS |
| Hosting | Vercel |

## Local development

### 1. Clone & install

```bash
git clone <your-repo-url>
cd card-game
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

### 3. Generate a `NEXTAUTH_SECRET`

```bash
openssl rand -base64 32
```

Paste the output as `NEXTAUTH_SECRET` in `.env`.

### 4. Set up an email provider

#### Option A — Ethereal (free, zero setup, no real emails sent)

```bash
node scripts/generate-ethereal.mjs
```

Copy the printed credentials into your `.env`. Then, after requesting a magic link, visit **https://ethereal.email/messages** to click the link.

#### Option B — Resend (free tier, sends real emails)

1. Sign up at [resend.com](https://resend.com) and get an API key.
2. Fill in `.env`:
