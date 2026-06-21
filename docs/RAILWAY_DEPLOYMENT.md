# LoyaltyPulse — Railway Deployment

## Railway service settings

| Setting | Value |
|---------|-------|
| **Root directory** | `/` (repository root — leave blank in Railway) |
| **Build command** | `npm run build` |
| **Start command** | `npm start` |

Defined in `railway.json`, `nixpacks.toml`, and `Procfile`.

## Startup sequence

1. **prestart** — `validate-production-env.mjs` (fails fast with clear errors if vars missing)
2. **migrate** — `migrate-deploy.mjs` → `prisma migrate deploy`
3. **server** — `node backend/src/index.js` (binds `0.0.0.0:PORT`, serves `frontend/dist`)

## Required environment variables

Copy from [`.env.production.example`](../.env.production.example) into Railway → **Variables**:

| Variable | When | Source |
|----------|------|--------|
| `DATABASE_URL` | Runtime | Railway PostgreSQL → `${{Postgres.DATABASE_URL}}` |
| `SHOPIFY_API_KEY` | Runtime | Partner Dashboard → API key |
| `SHOPIFY_API_SECRET` | Runtime | Partner Dashboard → API secret |
| `SHOPIFY_SCOPES` | Runtime | `read_orders,read_customers,write_discounts,write_app_proxy` |
| `HOST` | Runtime | Railway public URL (`https://….up.railway.app`) |
| `VITE_SHOPIFY_API_KEY` | **Build** | Same as `SHOPIFY_API_KEY` |
| `NODE_ENV` | Runtime | `production` |
| `PORT` | Runtime | Auto-injected by Railway |

## Pre-deploy verification

```bash
npm run verify:railway
npm run build
npm run verify:railway -- --build
```

## Troubleshooting crashes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Exit before "listening" | Missing env var | Check deploy logs for `LoyaltyPulse startup failed` banner |
| `prisma migrate deploy failed` | Bad `DATABASE_URL` | Link Postgres plugin; use public URL with `?sslmode=require` if needed |
| `Frontend build not found` | Build step skipped | Ensure `npm run build` runs; root directory is repo root |
| `Missing SHOPIFY_API_KEY` | Vars not set on Railway | Add all variables from `.env.production.example` |

## Monorepo note

Do **not** set Railway root directory to `backend/`.
