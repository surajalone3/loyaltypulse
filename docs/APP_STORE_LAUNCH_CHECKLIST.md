# LoyaltyPulse — Complete App Store Launch Checklist

End-to-end checklist from code freeze through public listing.

---

## Phase 1 — Code & infrastructure readiness

### Application

- [ ] All `verify:*` scripts pass on staging dev store
- [ ] [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) completed and signed off
- [ ] No ngrok or localhost URLs in `shopify.app.toml` or Partner Dashboard
- [ ] `NODE_ENV=production` on production host
- [ ] `DEV_MODE` unset on production
- [ ] Frontend built (`npm run build:frontend`) and served by backend
- [ ] Database migrations applied (`prisma migrate deploy`)
- [ ] Backend restarted after deploy (ensures latest redeem + webhook code)

### Security

- [ ] Webhook HMAC verification on all `/api/webhooks/*` routes
- [ ] App Proxy HMAC on `/apps/loyaltypulse/*` (except `/health`)
- [ ] Session token validation on all `/api/*` admin routes
- [ ] Secrets only in environment / secrets manager (not in git)
- [ ] `SHOPIFY_API_SECRET` never exposed to frontend
- [ ] GDPR handlers implemented and responding 200

### OAuth & permissions

- [ ] Scopes: `read_orders`, `read_customers`, `write_discounts`, `write_app_proxy`
- [ ] Scope justification documented for review
- [ ] Protected Customer Data request submitted and **approved**
- [ ] Re-install on test store after scope changes

---

## Phase 2 — Shopify Partner configuration

### App setup

- [ ] App name: **LoyaltyPulse**
- [ ] App URL = production `HOST`
- [ ] Allowed redirection URL(s) = `{HOST}/auth/callback`
- [ ] Embedded app enabled
- [ ] App proxy: prefix `apps`, subpath `loyaltypulse`

### Webhooks (TOML + live delivery)

| Topic | URI |
|-------|-----|
| `app/uninstalled` | `/api/webhooks/app-uninstalled` |
| GDPR compliance | `/api/webhooks/compliance` |
| `orders/paid` | `/api/webhooks/orders-paid` (OAuth registration) |

- [ ] Webhook delivery health shows 200 in Partner Dashboard
- [ ] Test compliance webhooks manually

### Theme extension

- [ ] `loyalty-pulse-widget` included in app version
- [ ] `shopify app deploy` publishes extension
- [ ] Block appears in theme editor

---

## Phase 3 — App Store listing

### Required assets

- [ ] App icon 1200×1200 PNG
- [ ] At least 3 screenshots (desktop):
  - Dashboard overview
  - Settings / tiers
  - Storefront widget or rewards
- [ ] App card subtitle (≤ 62 chars)
- [ ] App introduction (clear value proposition)
- [ ] Feature list with bullets
- [ ] Search terms (relevant, not trademark violations)

### Legal & support

- [ ] **Privacy policy URL** — covers:
  - Customer email, name, order history
  - Points, tiers, referrals, redemptions
  - Data retention and GDPR rights
  - Third-party processors (hosting, database)
- [ ] **Support URL** or support email
- [ ] Terms of service (if applicable)

### Pricing

- [ ] Pricing plan(s) configured in Partner Dashboard
- [ ] Billing API integrated (if charging) — *not yet implemented in LoyaltyPulse*

### Demo store (recommended)

- [ ] Development store with app installed
- [ ] Sample products and test customer with points
- [ ] Widget enabled on theme
- [ ] Demo credentials for reviewers (if required)

---

## Phase 4 — Reviewer test script

Provide in submission notes:

1. Install app on supplied dev store
2. Open **Settings** → confirm program name and earn rate
3. Place test order → verify points on **Dashboard**
4. Open storefront widget as logged-in customer → redeem reward
5. Apply `LP-XXXXXX` at checkout → discount applies
6. Apply referral code as second customer → first order triggers bonus
7. Confirm **Reviews** shows pending request after order
8. Uninstall → confirm clean session handling

---

## Phase 5 — Launch day

- [ ] Production deploy complete ([PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md))
- [ ] `shopify app deploy` with production URLs
- [ ] Submit app for review
- [ ] Monitor webhook error rate first 24h
- [ ] Support inbox ready for merchant questions ([MERCHANT_ONBOARDING.md](./MERCHANT_ONBOARDING.md))

---

## Phase 6 — Post-launch

- [ ] Monitor Partner Dashboard API errors
- [ ] Track install/uninstall ratio
- [ ] Collect merchant feedback on onboarding friction
- [ ] Plan: review email provider, billing, upsell schema cleanup

---

## Known limitations to disclose

| Item | Status |
|------|--------|
| Review emails | DB status only; no ESP integration |
| Upsell models | Schema present; feature not implemented |
| Billing | Not implemented |
| Orphan Shopify discounts | Rare edge case if DB fails after discount create |

---

## Quick reference

- Staging: [STAGING_DEPLOYMENT_GUIDE.md](./STAGING_DEPLOYMENT_GUIDE.md)
- Production: [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- Merchant docs: [MERCHANT_ONBOARDING.md](./MERCHANT_ONBOARDING.md)
- Testing: [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md)
