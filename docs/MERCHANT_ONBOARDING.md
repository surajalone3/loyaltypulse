# LoyaltyPulse — Merchant Onboarding Guide

Guide for merchants installing and configuring LoyaltyPulse.

## Installation

1. Install LoyaltyPulse from the Shopify App Store (or via install link from the developer).
2. Approve requested permissions:
   - Read orders — award points on paid orders
   - Read customers — match loyalty members
   - Write discounts — create reward coupon codes at checkout
   - App proxy — power the storefront loyalty widget
3. Open the app from **Shopify Admin → Apps → LoyaltyPulse**.

On first install, LoyaltyPulse automatically creates:

- Default loyalty program (10 points per dollar, configurable)
- Four tiers: Bronze, Silver, Gold, Platinum
- Default rewards catalog (if seeded by setup)

## Initial configuration

### 1. Loyalty program settings

Go to **Settings** in the app:

| Setting | Description |
|---------|-------------|
| Program name | Display name (e.g. "Stars") |
| Points per dollar | Earn rate on order total |
| Welcome bonus | Points for new members' first order |
| Referral bonus | Points for referrer when friend makes first purchase |
| Review requests | Enable/disable post-order review prompts |
| Review delay | Days after order before review request is sent |

### 2. Tier thresholds

Still in **Settings → Tiers**:

- Set minimum lifetime spend for Silver, Gold, Platinum
- Customize tier names, colors, and benefit descriptions
- Disabled tiers are skipped in progression

### 3. Rewards

Go to **Rewards**:

1. Create rewards with name, points required, and discount value
2. Choose discount type: percentage off or fixed amount
3. Activate rewards customers can redeem

When a customer redeems, they receive an `LP-XXXXXX` code — a real Shopify discount usable at checkout.

### 4. Storefront widget

1. Go to **Online Store → Themes → Customize**
2. Add the **LoyaltyPulse** app block to the desired template (e.g. customer account or homepage)
3. Save the theme

Logged-in customers see:

- Points balance and tier
- Progress to next tier
- Available rewards and redeem button
- Referral link and apply-code field

## How loyalty works (merchant view)

### Earning points

- Customer places a **paid order** → points awarded automatically
- Welcome bonus on first order (if configured)
- Referral bonuses when referred friend completes first purchase

### Tiers

- Lifetime spend determines tier (Bronze → Platinum)
- Tier updates automatically on each order

### Referrals

- Each customer gets a unique referral code (`LP-XXXXXX`)
- New customers apply a code via the widget
- Bonuses trigger on the referred customer's **first paid order**

### Reviews

- After each order, a review request is scheduled (if enabled)
- Status appears in **Reviews** in the admin app
- Email delivery requires merchant to configure review workflow separately (status tracked in app)

## Admin dashboard

**Dashboard** shows:

- Total members, points issued/redeemed
- Tier distribution chart
- Referral metrics and top referrers
- Review request stats
- 30-day activity charts

**Customers**, **Transactions**, **Rewards**, and **Reviews** pages provide searchable lists and detail panels.

## Customer support scenarios

| Question | Answer |
|----------|--------|
| "I didn't get points" | Order must be **paid**; customer email must be on the order |
| "My coupon doesn't work" | Codes are single-use and customer-scoped; check Shopify Admin → Discounts |
| "Referral didn't credit" | Referred customer must use code **before** first purchase; bonus on first paid order only |
| "Wrong tier" | Tier based on **lifetime spend**; check customer detail in app |

## Uninstall

When the merchant uninstalls:

- App sessions are removed immediately
- Store is deactivated in LoyaltyPulse
- Shop data is deleted after Shopify's retention period via `shop/redact` GDPR webhook

## Getting help

Merchants should contact the support URL listed on the App Store listing. Include shop domain, customer email, and order number when reporting issues.
