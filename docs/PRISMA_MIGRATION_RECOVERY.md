# Prisma migration recovery (Railway P3009)

## Why `20260607120000_add_rewards` failed

The migration runs:

```sql
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ...
```

**`Store` did not exist** in the migration history. The only prior migration (`20260531104657_init`) created `Session` alone. Core tables (`Store`, `Customer`, `LoyaltyProgram`, etc.) were never added via migrations — they were applied in development with `prisma db push`.

On a fresh Railway Postgres:

1. `init` applied successfully
2. `add_rewards` failed with `relation "Store" does not exist`
3. Prisma recorded the failure → **P3009** blocks further deploys

## Correct recovery option

| Option | Use when | For this project |
|--------|----------|------------------|
| `--rolled-back` | Migration **did not** complete successfully | **Yes — use this** |
| `--applied` | Migration **fully** succeeded but marked failed | No — Reward table was not created |
| New migration | Schema history gap / ordering bug | **Yes — `20260607100000_core_loyalty_schema`** |

Do **not** use `--applied` unless you have verified `"Reward"` exists with correct FK to `"Store"`.

## Railway recovery steps

### One-time (after deploying this fix)

**Option A — Railway shell / local with `DATABASE_URL`:**

```bash
npm run prisma:recover:railway
```

**Option B — Manual:**

```bash
cd backend
npx prisma migrate resolve --rolled-back 20260607120000_add_rewards
npx prisma migrate deploy
```

### Expected deploy order after recovery

1. `20260531104657_init` (already applied)
2. `20260607100000_core_loyalty_schema` (**new** — creates Store, Customer, etc.)
3. `20260607120000_add_rewards` (retried)
4. Remaining migrations through `20260621210000_query_indexes`

### Fresh Railway database (no failed state)

If you prefer a clean slate (no production data yet):

1. Railway → PostgreSQL → **Reset database** or create new DB
2. Redeploy — `prisma migrate deploy` runs all migrations in order

## Verify after recovery

```bash
cd backend
npx prisma migrate status
```

All migrations should show as applied.
