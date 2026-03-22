# Post Generator

AI-powered social media post scheduler. Next.js full-stack app on Vercel with Neon PostgreSQL, Clerk auth, and Vercel Blob storage.

## Prerequisites

- Node.js 20+
- Neon PostgreSQL database (or local Postgres for dev)
- Clerk account (auth)
- Vercel account (deployment, blob, cron)

## Quick start

### 1. Database

Create a Neon database and add the connection string to `.env.local`:

```
DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require
```

Apply migrations:

```bash
cd src
npx drizzle-kit push
# or: npx drizzle-kit migrate
```

### 2. Environment

Copy `.env.example` to `.env.local` and fill in:

- `DATABASE_URL` – Neon PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` – from [Clerk](https://clerk.com)
- `CRON_SECRET` – random string for cron auth (Vercel sends as Bearer token)
- `BLOB_READ_WRITE_TOKEN` – from Vercel Blob
- `MAILGUN_*` – Mailgun for post-publish notifications
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (optional) – for post generation

### 3. Run locally

```bash
cd src
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in via Clerk.

## Project layout

- `src` – Next.js App Router app (API routes, pages, components)
- `src/db` – Drizzle schema and client
- `src/lib` – Services (user, post, series, AI, publishers, etc.)
- `src/app/api` – API route handlers

## Deployment (Vercel)

1. Import the repo in [Vercel](https://vercel.com) and set **Root Directory** to `src`.
2. Add environment variables in the project settings.
3. Deploy. The cron job (`/api/cron/publish`) runs every 5 minutes (Vercel Pro for sub-daily frequency).

## Scheduled publishing

The `/api/cron/publish` route is invoked by Vercel Cron. It queries posts with `status = Scheduled` and `scheduledAt <= now`, publishes them to the configured platforms, and sends Mailgun notifications. Protect it with `CRON_SECRET` (Vercel adds `Authorization: Bearer <CRON_SECRET>` automatically).
