# LoyaltyPulse — Production Deployment Checklist

> Full walkthrough: [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md)

Use this checklist before pointing a live Shopify store at production infrastructure.

## 1. Infrastructure

- [ ] **Production host** — Stable HTTPS domain (not ngrok). Set `HOST=https://api.yourdomain.com` (no trailing slash).
- [ ] **Database** — Managed PostgreSQL with backups, connection pooling, and `DATABASE_URL` in secrets.
- [ ] **Process** — Node backend runs behind a reverse proxy (TLS termination at load balancer or proxy).
- [ ] **Secrets** — `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `DATABASE_URL` stored in a secrets manager (not committed).
- [ ] **`NODE_ENV=production`** — Disables dev routes (`/api/dev/*`) and verbose OAuth logging.
- [ ] **`DEV_MODE` unset or `false`** — Enables automatic webhook registration on OAuth.

## 2. Shopify App Configuration

- [ ] **`shopify.app.toml`** — `application_url`, `redirect_urls`, and `[app_proxy].url` use production `HOST`.
- [ ] **OAuth scopes** — `read_orders,read_customers,write_discounts,write_app_proxy` (matches `.env` `SHOPIFY_SCOPES`).
- [ ] **Deploy app config** — `shopify app deploy` (or Partner Dashboard) so webhooks and scopes match production.
- [ ] **Protected Customer Data** — Request and obtain approval for order/customer fields required by `orders/paid`.
- [ ] **App Proxy** — Subpath `loyaltypulse`, prefix `apps`; storefront paths `/apps/loyaltypulse/*` resolve to backend.

## 3. Webhooks

Configured in `shopify.app.toml` and registered on OAuth:

| Topic | Endpoint |
|-------|----------|
| `orders/paid` | `POST /api/webhooks/orders-paid` |
| `app/uninstalled` | `POST /api/webhooks/app-uninstalled` |
| GDPR compliance | `POST /api/webhooks/compliance` |

- [ ] Re-install app on staging shop after deploy to register `orders/paid` and `app/uninstalled` (if not using TOML-only delivery).
- [ ] Verify HMAC: `SHOPIFY_API_SECRET` matches Partner Dashboard app secret.
- [ ] Confirm webhook delivery in Partner Dashboard → API health (200 responses).

## 4. Database Migrations

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

- [ ] Migration `20260621200000_shopify_discount_redemption` applied (Reward/Redemption discount fields).
- [ ] All prior loyalty migrations applied.

## 5. Smoke Tests (staging shop)

- [ ] **OAuth install** — Merchant can open embedded app.
- [ ] **Place test order** — Customer created, points awarded, tier updated.
- [ ] **Redeem reward** — `LP-XXXXXX` code created in Shopify Admin → Discounts; usable at checkout.
- [ ] **Referral** — Apply code, first purchase awards bonuses.
- [ ] **Review request** — Scheduled after order (status in dashboard).
- [ ] **App uninstall** — Sessions cleared, store deactivated.
- [ ] **GDPR** — Send test compliance webhooks from Partner Dashboard (or Shopify CLI).

## 6. Monitoring & Operations

- [ ] Structured logging for `[webhook:*]`, `[redeem]`, `[gdpr]` prefixes.
- [ ] Alert on 5xx from webhook endpoints.
- [ ] Run verification scripts after deploy:

```bash
cd backend
npm run verify:settings
npm run verify:tiers
npm run verify:referrals
npm run verify:reviews
npm run verify:redemption
```

- [ ] Document rollback: previous container/image + `prisma migrate` history.

## 7. Known Production Constraints

- **Redemption** creates Shopify discount before DB commit; rare DB failure may leave an orphan discount (logged).
- **Review emails** — Status is tracked in DB; external email provider is not integrated.
- **`orders/paid` without email** — Webhook returns 400; ensure customer email on orders for loyalty matching.
