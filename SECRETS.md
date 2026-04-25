# Secrets

This repo contains **no real secrets**. Anything sensitive lives in one of three places:

1. Your local machine — `.env.local` (gitignored)
2. **AWS SSM Parameter Store** — runtime config for production (path: `/finance-os/prod/*`)
3. **GitHub Actions Secrets** — only for CI/CD that needs to push artifacts or trigger deploys

> Maintainer: Hamza Lachehab El Hilali

## Local development

Copy `.env.example` to `.env` and fill in your local values. Never commit `.env`.

```bash
cp .env.example .env
```

## Production runtime (AWS SSM Parameter Store)

The EC2 host fetches every key under `/finance-os/prod/` at boot via `infra/userdata.sh`
(kept in a separate private location, not in this repo) and writes them to `/opt/finance-os/.env`.
Keys expected:

| SSM parameter | Purpose |
| --- | --- |
| `/finance-os/prod/DATABASE_URL` | Postgres connection string |
| `/finance-os/prod/POSTGRES_PASSWORD` | DB password (also used by docker compose db service) |
| `/finance-os/prod/AUTH_SECRET` | NextAuth signing secret (`openssl rand -base64 32`) |
| `/finance-os/prod/NEXTAUTH_URL` | Public app URL |
| `/finance-os/prod/ADMIN_USER` | Admin login |
| `/finance-os/prod/ADMIN_PASSWORD` | Bcrypt hash of admin password |
| `/finance-os/prod/AWS_REGION` | AWS region |
| `/finance-os/prod/S3_BUCKET_NAME` | Private receipts bucket |
| `/finance-os/prod/BEDROCK_MODEL_ID` | Claude model ID for chat & OCR |
| `/finance-os/prod/TUNNEL_TOKEN` | Cloudflared tunnel token |

To rotate a secret:

```bash
aws ssm put-parameter \
  --name /finance-os/prod/AUTH_SECRET \
  --value "$(openssl rand -base64 32)" \
  --type SecureString \
  --overwrite \
  --region eu-central-1
```

Then reboot or re-run `userdata.sh` on the EC2 host so the new value is written to `.env`
and `docker compose up -d` is re-applied.

AWS access from the EC2 host is granted by an **IAM instance role** — there are no AWS access keys anywhere in this repo or on the host filesystem.

## CI/CD (GitHub Actions)

CI (`.github/workflows/ci.yml`) needs **no secrets** — it lints, typechecks, tests, and builds against placeholder env vars.

Deploy (`.github/workflows/deploy.yml`) uses **OIDC** to assume an AWS IAM role — no AWS access keys are stored on GitHub. It uploads the tarball to `s3://.../app-src/finance-os.tar.gz` and triggers `userdata.sh` rerun on EC2 via SSM Send-Command. It never sees runtime secrets.

GitHub repo **variables** (Settings → Secrets and variables → Actions → **Variables** tab) — these are not secrets, they are configuration:

| Variable name | Purpose |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | The IAM role ARN created by `infra/setup-github-oidc.sh`. Useless without OIDC trust. |
| `EC2_INSTANCE_ID` | The `i-...` id of the prod EC2 instance to redeploy |

GitHub repo **secrets**: **none**. The deploy role is OIDC-trusted and locked to this repo + `main` branch.

> **Never** add `AUTH_SECRET`, `ADMIN_PASSWORD`, `ADMIN_USER`, `DATABASE_URL`, or any runtime secret to GitHub Actions. Those belong in SSM Parameter Store, where the runtime host reads them at boot.

## Pre-push checklist

Before pushing anything to this repo, verify:

```bash
git diff --cached | grep -iE '(AKIA|aws_secret|password\s*=\s*[^"]*[a-z0-9]{8}|sk-[a-z0-9]{20}|ghp_|github_pat_)'
```

If that prints nothing, you're clean.
