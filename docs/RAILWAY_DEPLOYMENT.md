# LoyaltyPulse — Railway Deployment

## Railway service settings

| Setting | Value |
|---------|-------|
| **Root directory** | `/` (repository root — leave blank in Railway) |
| **Build command** | `npm run build` |
| **Start command** | `npm start` |

These are also defined in `railway.json`, `nixpacks.toml`, and `Procfile`.

## Required environment variables

Set in Railway → **Variables**:

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes (PostgreSQL plugin or external) |
| `SHOPIFY_API_KEY` | Yes |
| `SHOPIFY_API_SECRET` | Yes |
| `SHOPIFY_SCOPES` | Yes |
| `HOST` | Yes — your Railway public URL (e.g. `https://loyaltypulse-production.up.railway.app`) |
| `NODE_ENV` | `production` |
| `VITE_SHOPIFY_API_KEY` | Yes — same as `SHOPIFY_API_KEY` (used at **build** time for frontend) |

Do **not** set `DEV_MODE=true` in production.

## What happens on deploy

1. **Install** — `postinstall` installs `backend/` and `frontend/` dependencies (`NIXPACKS_INSTALL_DEV_DEPS=true` keeps Vite available).
2. **Build** — `npm run build` → Vite builds admin UI to `frontend/dist`, then `prisma generate`.
3. **Start** — `npm start` → `prisma migrate deploy` then `node backend/src/index.js`.
4. Server listens on `process.env.PORT` (set automatically by Railway).

## After first deploy

1. Set `HOST` to the Railway service URL and redeploy.
2. Update `shopify.app.toml` / Partner Dashboard URLs to match.
3. Run `shopify app deploy` to sync app config.

## Monorepo note

Do **not** set Railway root directory to `backend/` — the server serves the built frontend from `frontend/dist` at the repo root.
