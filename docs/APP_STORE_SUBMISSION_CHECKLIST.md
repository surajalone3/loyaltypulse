# LoyaltyPulse — App Store Submission Checklist

> Complete launch checklist: [APP_STORE_LAUNCH_CHECKLIST.md](./APP_STORE_LAUNCH_CHECKLIST.md)

Complete before submitting to the Shopify App Store review.

## 1. App Listing (Partner Dashboard)

- [ ] **App name** — LoyaltyPulse (consistent with `shopify.app.toml`).
- [ ] **Icon** — 1200×1200 PNG, no Shopify trademark misuse.
- [ ] **Screenshots** — Dashboard (settings, tiers, referrals, reviews), storefront widget.
- [ ] **Demo video** (recommended) — Install → earn points on order → redeem discount at checkout.
- [ ] **Pricing** — Plan(s) defined if billing is enabled.
- [ ] **Support URL** — Public page with contact method.
- [ ] **Privacy policy URL** — Describes loyalty data, retention, GDPR handling.
- [ ] **App introduction** — Clear description of points, tiers, referrals, reviews, rewards.

## 2. Technical Requirements

- [ ] **Embedded app** — Loads in Shopify Admin iframe without CSP/X-Frame errors.
- [ ] **OAuth** — Minimal scopes: `read_orders`, `read_customers`, `write_discounts`, `write_app_proxy`.
- [ ] **GDPR webhooks** — `customers/data_request`, `customers/redact`, `shop/redact` → `POST /api/webhooks/compliance`.
- [ ] **`app/uninstalled`** — `POST /api/webhooks/app-uninstalled` deactivates store and deletes sessions.
- [ ] **Session tokens** — Admin API uses online/offline sessions per Shopify embedded app guidelines.
- [ ] **No hardcoded ngrok URLs** in production build or Partner app URLs.

## 3. Protected Customer Data

- [ ] Submit **Protected customer data** access request in Partner Dashboard.
- [ ] Justify use of order and customer fields for loyalty (points, tier, referral matching).
- [ ] Do not request scopes or API fields beyond what the app uses.

## 4. Functional Review Scenarios

Reviewers typically verify:

| Scenario | Expected behavior |
|----------|-------------------|
| Install app | OAuth succeeds, default loyalty program + tiers created |
| Paid order | Points earned, customer tier updated |
| Redeem reward | Shopify discount code created, single-use, checkout applies discount |
| Uninstall | Webhook received, sessions removed |
| Customer data request | App responds 200 with compiled loyalty data |
| Customer redact | Customer PII removed from app database |
| Shop redact | All shop data deleted after retention period |

- [ ] Test each scenario on a **clean dev store** before submission.

## 5. Theme App Extension

- [ ] **loyalty-pulse-widget** extension published with app version.
- [ ] Merchant can enable block in theme editor.
- [ ] Widget loads via App Proxy (`/apps/loyaltypulse/loyalty`) for logged-in customers.
- [ ] Redeem flow shows coupon code after successful redemption.

## 6. Security & Compliance

- [ ] Webhook HMAC verification on all `POST /api/webhooks/*` routes.
- [ ] App Proxy HMAC verification on storefront routes.
- [ ] No API secrets in frontend bundle (`VITE_SHOPIFY_API_KEY` is public client id only).
- [ ] GDPR: `shop/redact` deletes `Store` and cascaded loyalty data.

## 7. Pre-Submission Commands

```bash
cd backend
npm run verify:settings
npm run verify:tiers
npm run verify:referrals
npm run verify:reviews
npm run verify:redemption
```

- [ ] All verification scripts pass (or document expected skips without live Shopify session).

## 8. Common Rejection Reasons to Avoid

- Missing or non-responding GDPR webhooks.
- Excessive OAuth scopes without justification.
- Discount codes that do not work at checkout.
- Broken embedded app URL or redirect mismatch.
- Privacy policy that does not mention loyalty/referral data collection.
