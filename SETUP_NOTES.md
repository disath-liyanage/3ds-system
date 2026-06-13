# 3D's Distributors (PVT) Ltd. Setup Notes

## 1) What to copy into Supabase SQL Editor

Run the full schema in:

- `supabase/schema.sql`

This file creates:

- all required tables and relationships
- display number sequences (`order_number`, `collection_number`, `invoice_number`, `rn_number`)
- RLS on every table
- policies for `admin`, `manager`, `sales_rep`, and `cashier`
- order audit triggers on insert/update

## 2) Env vars to set

Web app (`apps/web/.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

Templates are included in:

- `apps/web/.env.local.example`

## 3) How to run dev servers

From repo root:

```bash
pnpm install
```

Run web app:

```bash
pnpm dev:web
```

Optional production build check for web:

```bash
pnpm build:web
```

## 4) First-time setup order

1. Create Supabase project and collect project URL + anon key.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Add env vars to `apps/web/.env.local`.
4. Install dependencies with `pnpm install` at repo root.
5. Start web (`pnpm dev:web`) and confirm login route loads.
6. Create initial users in `auth.users`, then add matching rows in `users_profile` with roles.

## 5) Vercel env var reminder (admin user management)

For production deploys, set this in Vercel:

1. Go to Vercel -> Project -> Settings -> Environment Variables.
2. Add `SUPABASE_SERVICE_ROLE_KEY`.
3. Get the value from Supabase -> Project Settings -> API -> `service_role` secret.

Important:

- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- Never expose it to the browser.
- Never commit it to git.