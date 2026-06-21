# LoyaltyPulse — Testing Checklist

Manual and automated tests before staging sign-off or production release.

## Automated verification

Run from `backend/` (requires dev store installed and `DATABASE_URL` set):

```bash
npm run verify:settings
npm run verify:tiers
npm run verify:referrals
npm run verify:reviews
npm run verify:redemption
```

Set `VERIFY_SHOP=your-store.myshopify.com` if not using the default test shop.

---

## Points

| # | Test | Steps | Expected |
|---|------|-------|----------|
| P1 | First order earns points | Place paid order as new customer | Customer created; points = floor(order total × points per dollar) |
| P2 | Welcome bonus | First order with welcome bonus > 0 | Bonus transaction type `BONUS`; balance includes welcome + earned |
| P3 | Repeat order | Second paid order same customer | Points increment; no duplicate welcome bonus |
| P4 | Program disabled | Disable program in Settings; place order | Order webhook skips or awards 0 (verify current behavior) |
| P5 | Transaction ledger | Open **Transactions** in admin | `EARNED` row with order reference |
| P6 | Dashboard metrics | Open **Dashboard** | Total points issued increases |
| P7 | Widget balance | Logged-in customer views widget | `totalPoints` matches admin |

**Dev shortcut:** `POST /api/dev/process-order` (non-production only)

---

## Redemption

| # | Test | Steps | Expected |
|---|------|-------|----------|
| R1 | Insufficient points | Redeem with balance < reward cost | 400 `insufficient_points` |
| R2 | Successful redeem | Redeem from widget or admin | `LP-XXXXXX` code returned |
| R3 | Shopify discount | Check Shopify Admin → Discounts | Discount exists, single-use |
| R4 | Checkout | Apply code at checkout | Discount applies |
| R5 | Points deducted | Check customer balance | Reduced by `pointsRequired` |
| R6 | Ledger | **Transactions** | `REDEEMED` row |
| R7 | DB metadata | Redemption record | `shopifyDiscountId`, `discountType`, `discountValue` populated |
| R8 | Not logged in | Redeem without customer session | 401 `not_logged_in` |

**Dev shortcut:** `POST /api/dev/redeem` with `{ customerId, rewardId }`

---

## Referrals

| # | Test | Steps | Expected |
|---|------|-------|----------|
| F1 | Referral link | Customer A opens widget | Referral code and URL shown |
| F2 | Apply code | Customer B applies A's code (logged in) | Referral row `PENDING` |
| F3 | Self-referral | Customer applies own code | Rejected |
| F4 | Duplicate apply | Customer B applies second code | Rejected |
| F5 | First purchase bonus | B completes first paid order | Referrer gets referral bonus; status `COMPLETED` |
| F6 | Referrer stats | Widget / dashboard | Successful referrals count updated |
| F7 | Dashboard | **Dashboard** referral section | Conversion rate, top referrers |

---

## Reviews

| # | Test | Steps | Expected |
|---|------|-------|----------|
| V1 | Auto-create | Place paid order | Review request `PENDING` with `scheduledSendAt` |
| V2 | Delay | Set delay to 3 days; new order | `scheduledSendAt` = order date + 3 days |
| V3 | Scheduler send | Wait or set delay 0; run scheduler | Status → `SENT`, `sentAt` set |
| V4 | Disabled | Turn off review requests | No new requests created |
| V5 | Complete | Mark complete via API or flow | Status `COMPLETED`, `reviewedAt` set |
| V6 | Admin list | **Reviews** page | Request visible with status badge |
| V7 | Dashboard | Review pending/completed counts | Metrics match DB |

**Note:** Email is not sent to an external provider; status is tracked in the database only.

---

## Tiers

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T1 | Default tier | New customer, small order | `BRONZE` |
| T2 | Upgrade | Order pushing lifetime spend over Silver threshold | Tier → `SILVER` |
| T3 | Custom thresholds | Change Silver min spend in Settings | Re-evaluate on next order |
| T4 | Widget progress | View widget as Silver customer | Next tier name and spend remaining shown |
| T5 | Dashboard chart | **Dashboard** tier distribution | Counts per tier |
| T6 | Customer filter | **Customers** filter by tier | Correct subset |
| T7 | Platinum cap | Spend above Platinum threshold | Stays `PLATINUM` |

---

## Cross-cutting

| # | Test | Expected |
|---|------|----------|
| X1 | OAuth install | Embedded app loads |
| X2 | App uninstall webhook | Sessions deleted; store deactivated |
| X3 | GDPR data request | 200 + customer loyalty data |
| X4 | GDPR customer redact | Customer PII removed |
| X5 | GDPR shop redact | All shop data deleted |
| X6 | App proxy HMAC | Unsigned storefront request rejected |
| X7 | Webhook HMAC | Invalid signature rejected |

---

## Sign-off

| Role | Name | Date | Pass |
|------|------|------|------|
| Engineering | | | |
| QA | | | |
| Product | | | |
