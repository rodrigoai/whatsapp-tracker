# WhatsApp Tracking App

Tracks WhatsApp leads by account, stores Google Ads click identifiers, rotates leads across active attendants, and exports conversion data for Google Ads imports.

## Setup

```bash
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Open `http://localhost:3000/admin`.

## Environment

Create `.env` with:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="replace-me"
```

For local development, use a local PostgreSQL database or a hosted development database. SQLite is not used because Vercel serverless functions do not provide durable local disk storage.

## Scripts

- `npm run dev`: start local Next.js development server.
- `npm run build`: production build.
- `npm run vercel-build`: Vercel build command; applies migrations, generates Prisma Client, then builds Next.js.
- `npm run start`: serve a production build.
- `npm run lint`: run ESLint directly. Next.js 16 removed `next lint`.
- `npm test`: run Jest tests.
- `npm run db:deploy`: apply Prisma migrations to `DATABASE_URL`.
- `npm run db:backup`: create a timestamped PostgreSQL backup in `backups/` (or pass a directory as the first argument).
- `npm run db:restore -- backups/whatsapp-tracking-YYYYMMDDTHHMMSSZ.dump`: restore a backup after confirming interactively. Add `--yes` only when intentionally skipping the confirmation.

## Deploy on Vercel

Provision a PostgreSQL database first, for example Vercel Postgres, Neon, Supabase, or another managed Postgres provider.

Database backups require the PostgreSQL client tools (`pg_dump`, `pg_restore`, and `psql`) to be installed locally. The scripts automatically load `DATABASE_URL` from the project `.env` file; set `ENV_FILE` to use a different environment file. The restore script removes PostgreSQL 17's unsupported `transaction_timeout` statement and source-only extensions (`prisma_postgres` and `pg_stat_statements`) so backups can be restored to PostgreSQL 16 on RDS without superuser permissions. Keep backup files outside version control; the default `backups/` directory is ignored by Git.

Set these Vercel Environment Variables:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="https://your-project.vercel.app"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="replace-with-a-strong-password"
```

The included `vercel.json` runs `npm run vercel-build`, which applies Prisma migrations during deployment.

## Tracking Script

Create an account in `/admin`, configure attendants and button settings, then copy the script tag from `/admin/config`.

`Allowed Origins` accepts `*` or a comma-separated list such as:

```text
https://example.com, https://shop.example.com
```

Use explicit origins in production to restrict which sites can post conversions for an account.

## Import Format

The import endpoint accepts `.csv`, `.xls`, or `.xlsx` files from the Leads screen. It matches existing leads by:

1. Email columns: `e-mail`, `Email`, `email`, `E-mail`
2. Phone columns: `Fone`, `phone`, `Phone`, `Telefone`
3. Mobile columns: `Celular`, `mobile`, `Mobile`

Value is calculated from `Valor unitário` or `Price`, multiplied by `Quantidade` or `Quantity`.

## Verification

Run before shipping changes:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```
