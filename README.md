# Finance OS

Self-hosted personal & business finance management PWA — built for a multi-currency freelancer/entrepreneur (MAD, GBP, USD, EUR).

> Author: **Hamza Lachehab El Hilali**

## Features

- **Multi-currency** dashboards with live FX conversion (MAD / GBP / USD / EUR)
- **Personal & business** views — income, expenses, transactions, payroll, recurring, subscriptions
- **AI financial advisor** (streaming chat) and **receipt OCR** via AWS Bedrock (Claude)
- **Private receipt storage** in S3 with presigned URLs
- **Net worth, loans, goals, health score, reports**
- **Installable PWA** with offline page (Workbox via `@ducanh2912/next-pwa`)
- **Single admin user** auth (env-configured) via NextAuth credentials

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn-style local UI primitives
- PostgreSQL + Prisma 7
- NextAuth v5 (credentials)
- AWS S3 (receipts) + AWS Bedrock (Claude) — IAM role-based credentials
- Recharts dashboards
- Vitest + Testing Library

## Local setup

1. **Copy env vars**

   ```bash
   cp .env.example .env
   ```

2. **Edit `.env`** — at minimum set:

   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/finance_os?schema=public"
   AUTH_SECRET="$(openssl rand -base64 32)"
   ADMIN_USER="admin"
   ADMIN_PASSWORD="change-me"
   AWS_REGION="eu-west-2"
   S3_BUCKET_NAME="your-private-receipts-bucket"
   BEDROCK_MODEL_ID="anthropic.claude-sonnet-4-20250514-v1:0"
   ```

3. **Prepare the database**

   ```bash
   npm install
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and sign in with `ADMIN_USER` / `ADMIN_PASSWORD`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (Webpack — required by the PWA plugin) |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |

## Production notes

- Run on AWS (ECS / App Runner / EC2) with an IAM role that grants S3 + Bedrock access.
- **Do not** set AWS access keys in the app — the SDK uses role-based credentials.
- Configure the S3 bucket as private. Lifecycle rule example: see `docs/aws-s3-lifecycle.md`.
- Production builds use Webpack because the PWA plugin injects Workbox through Webpack.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The same checks run automatically in [GitHub Actions](.github/workflows/ci.yml) on every push and PR to `main`.

## Secrets

This repo contains no real secrets. See [`SECRETS.md`](./SECRETS.md) for where they actually live (local `.env`, AWS SSM Parameter Store, GitHub Actions Secrets) and how to rotate them.

## License

Personal project — all rights reserved by Hamza Lachehab El Hilali.
