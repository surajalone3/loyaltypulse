# LoyaltyPulse — Production Deployment Guide

Step-by-step guide for deploying LoyaltyPulse to production infrastructure.

## Prerequisites

- Shopify Partner account with app created
- Production domain with valid TLS certificate
- Managed PostgreSQL (e.g. Supabase, RDS, Neon)
- Node.js 20+ on the host or container platform
- Protected Customer Data approval (required for `orders/paid` webhooks)

## Architecture

```
Shopify Admin (embedded iframe)
        ↓
Production HOST (HTTPS)
        ↓
Express backend (port 3000)
  ├── /auth          OAuth
  ├── /api/*         Admin API (session token)
  ├── /api/webhooks  Shopify webhooks (HMAC)
  ├── /apps/loyaltypulse/*  App proxy (storefront)
  └── /*             frontend/dist (SPA)
        ↓
PostgreSQL (Prisma)
```

## Step 1 — Environment variables

Set these in your secrets manager or hosting platform:

| Variable | Example | Notes |
|----------|---------|-------|
| `HOST` | `https://api.loyaltypulse.com` | No trailing slash |
| `SHOPIFY_API_KEY` | From Partner Dashboard | |
| `SHOPIFY_API_SECRET` | From Partner Dashboard | Used for HMAC |
| `SHOPIFY_SCOPES` | `read_orders,read_customers,write_discounts,write_app_proxy` | Must match TOML |
| `DATABASE_URL` | `postgresql://...` | Connection pooling recommended |
| `NODE_ENV` | `production` | Disables `/api/dev/*` |
| `PORT` | `3000` | |
| `VITE_SHOPIFY_API_KEY` | Same as `SHOPIFY_API_KEY` | Build-time for frontend |

**Do not set** `DEV_MODE=true` in production.

## Step 2 — Build and deploy

```bash
# Install dependencies
npm install

# Build admin frontend
npm run build:frontend

# Apply database migrations
cd backend && npx prisma migrate deploy && npx prisma generate

# Start server
cd backend && npm start
```

For container deploys, run migrations as a release phase before starting the web process.

## Step 3 — Configure Shopify app

1. Update `shopify.app.toml`:
   - `application_url` → production `HOST`
   - `redirect_urls` → `{HOST}/auth/callback`
   - `[app_proxy].url` → `{HOST}/apps/loyaltypulse`
   - Confirm scopes and webhook URIs

2. Deploy app configuration:

```bash
shopify app deploy
```

3. Update Partner Dashboard app URLs if not auto-synced.

## Step 4 — Webhook delivery

| Topic | Endpoint |
|-------|----------|
| `orders/paid` | `POST /api/webhooks/orders-paid` |
| `app/uninstalled` | `POST /api/webhooks/app-uninstalled` |
| GDPR compliance | `POST /api/webhooks/compliance` |

`orders/paid` and `app/uninstalled` are also registered programmatically on OAuth (`registerWebhooks.js`).

Verify in Partner Dashboard → **API health** that webhooks return HTTP 200.

## Step 5 — Post-deploy verification

```bash
cd backend
npm run verify:settings
npm run verify:tiers
npm run verify:referrals
npm run verify:reviews
npm run verify:redemption
```

Manual smoke tests on a production-connected dev store:

1. Install / open embedded app
2. Place a paid order → points + tier update
3. Redeem reward → discount in Shopify Admin → checkout
4. Uninstall → sessions cleared

## Step 6 — Monitoring

Watch logs for these prefixes:

- `[webhook:orders-paid]` — order processing
- `[webhook:app-uninstalled]` — uninstall cleanup
- `[gdpr]` — compliance handlers
- `[redeem]` / `[shopify-discount]` — redemption
- `[review-scheduler]` — due review sends

Alert on sustained 5xx from webhook endpoints.

## Rollback

1. Redeploy previous container/image
2. If a migration was applied, restore DB from backup or run a down migration manually
3. Re-install app on affected shops if webhook URLs changed

## Quick checklist

See [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md) for a printable checklist.
