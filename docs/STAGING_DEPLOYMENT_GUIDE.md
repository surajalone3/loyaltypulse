# LoyaltyPulse — Staging Deployment Guide

Use a staging environment to validate releases before production.

## Goals

- Mirror production architecture (HTTPS, PostgreSQL, embedded app)
- Connect to a **development store** (not live merchant data)
- Allow `shopify app dev` or a dedicated staging tunnel/domain

## Recommended setup

| Component | Staging value |
|-----------|---------------|
| Store | Shopify development store |
| `HOST` | Staging subdomain (e.g. `https://staging-api.loyaltypulse.com`) or Cloudflare tunnel from `shopify app dev` |
| Database | Separate PostgreSQL instance/schema from production |
| `NODE_ENV` | `production` (to test prod code paths) or `development` (for `/api/dev` helpers) |
| `DEV_MODE` | `true` only if Protected Customer Data is not yet approved |

## Option A — Shopify CLI dev (fastest)

```bash
# Terminal 1
npm run dev:frontend

# Terminal 2
npm run dev:shopify
```

`shopify app dev` updates tunnel URLs on the dev store automatically. Best for day-to-day feature verification.

## Option B — Dedicated staging host

1. Provision staging server + PostgreSQL
2. Copy `.env.example` → `.env.staging` with staging credentials
3. Set `HOST` to staging domain
4. Build and deploy:

```bash
npm run build:frontend
cd backend && npx prisma migrate deploy && npm start
```

5. Update `shopify.app.toml` staging URLs or use a separate app in Partner Dashboard
6. `shopify app deploy` to push config to the staging app

## Database

Always use an isolated staging database:

```bash
cd backend
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

Never point staging at production `DATABASE_URL`.

## Staging verification workflow

1. **Install** app on dev store via `/auth?shop=your-dev-store.myshopify.com`
2. **Run automated checks:**

```bash
cd backend
VERIFY_SHOP=your-dev-store.myshopify.com npm run verify:settings
VERIFY_SHOP=your-dev-store.myshopify.com npm run verify:tiers
VERIFY_SHOP=your-dev-store.myshopify.com npm run verify:referrals
VERIFY_SHOP=your-dev-store.myshopify.com npm run verify:reviews
VERIFY_SHOP=your-dev-store.myshopify.com npm run verify:redemption
```

3. **Enable theme widget** — Online Store → Themes → Customize → add LoyaltyPulse block
4. **Walk through** [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md)
5. **Test webhooks** — Partner Dashboard → send test compliance payloads; place test orders

## Staging vs production differences

| Setting | Staging | Production |
|---------|---------|------------|
| Dev store | Yes | No (merchant stores) |
| `DEV_MODE` | Optional `true` | `false` / unset |
| `/api/dev/*` | Available if `NODE_ENV !== production` | Disabled |
| Email provider | Not required (review status DB-only) | Same until integrated |
| Protected Customer Data | May be pending | Must be approved |

## Promoting staging → production

1. Tag release in git
2. Deploy same artifact to production host
3. Run `prisma migrate deploy` on production DB
4. `shopify app deploy` with production URLs in TOML
5. Re-run verification scripts against production-connected test store
6. Complete [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md)
