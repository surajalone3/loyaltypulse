# LoyaltyPulse

Shopify embedded app with Node.js + Express backend, React + Polaris frontend, and PostgreSQL session storage via Prisma.

## Project structure

```
loyaltypulse/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── prisma.config.js
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── shopify.js
│       ├── middleware/
│       │   └── validateSession.js
│       └── routes/
│           ├── auth.js
│           └── api.js
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── pages/
        │   └── HomePage.jsx
        └── utils/
            ├── appBridge.js
            └── api.js
```

## Setup

1. Create a [Shopify Partner](https://partners.shopify.com) app and copy API key/secret.
2. Set `HOST` to your public URL (e.g. Cloudflare Tunnel or ngrok).
3. In the Partner Dashboard, set **App URL** to `{HOST}` and **Allowed redirection URL(s)** to `{HOST}/auth/callback`.
4. Update `.env` with real credentials and `DATABASE_URL`.
5. Install dependencies and migrate the database:

```bash
npm install
cd backend && npm run prisma:generate && npm run prisma:migrate
```

6. Run backend and frontend (two terminals):

```bash
npm run dev:backend
npm run dev:frontend
```

7. Install on a dev store: `https://{HOST}/auth?shop=your-store.myshopify.com`

## Routes

| Route | Description |
|-------|-------------|
| `GET /auth` | Start OAuth (requires `?shop=`) |
| `GET /auth/callback` | OAuth callback (HMAC verified by Shopify API lib) |
| `GET /api` | Authenticated app info |
| `GET /api/products/count` | Example Admin API query |
