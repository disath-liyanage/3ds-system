  <div align="center">
    <img src="https://www.3dsdis.com/images/3D's.png" alt="3D's Distributors" width="400" />
    <p>Business management system for 3D's Distributors (PVT) Ltd.</p>

    [Tech Stack](#tech-stack) · [Features](#features) · [Repo Structure](#repo-structure) · [Getting Started](#getting-started) · [Production](#production) · [Documentation](#documentation)
  </div>

  ---

  ## Overview

  A full-stack business management system for 3D's Distributors (PVT) Ltd, handling end-to-end sales operations — from order intake to invoicing, credit collection, and staff management. Built as a Next.js web dashboard backed by Supabase, with shared types and client config in `packages/shared`.

  ## Tech Stack

  | Layer | Technology |
  |---|---|
  | Web frontend | Next.js 14 (App Router) |
  | Backend / DB | Supabase (PostgreSQL + RLS + Auth) |
  | Shared packages | pnpm workspaces + Turborepo |
  | Deployment | Vercel |
  | Language | TypeScript |

  ## Features

  - Order management with role-based approval flows
  - Credit invoicing with 45-day collection cycle
  - Field collection tracking with manager approval
  - Staff advances and loans with salary deduction tracking
  - Sales targets and incentive management
  - HR, payroll, EPF/ETF, and attendance tracking
  - Post-dated cheque reminders
  - Role-based access across 4 user types: `admin`, `manager`, `sales_rep`, `cashier`

  ## Repo Structure

  ```
  3ds-system/
  ├── apps/
  │   └── web/          # Next.js 14 web app
  ├── packages/
  │   └── shared/       # Shared types, utils, Supabase client
  ├── supabase/
  │   └── schema.sql    # Full schema, RLS policies, triggers
  ├── turbo.json
  └── pnpm-workspace.yaml
  ```

  ## Getting Started

  ### Prerequisites

  - Node.js 18+
  - pnpm 11+
  - A [Supabase](https://supabase.com) project

  ### 1. Clone and install

  ```bash
  git clone https://github.com/disath-liyanage/3ds-system.git
  cd 3ds-system
  pnpm install
  ```

  ### 2. Set up the database

  Run `supabase/schema.sql` in your Supabase SQL Editor. This creates all tables, RLS policies, role permissions, display number sequences, and audit triggers.

  ### 3. Configure environment variables

  Create `apps/web/.env.local`:

  ```env
  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  ```

  A template is at `apps/web/.env.local.example`.

  ### 4. Run dev server

  ```bash
  pnpm dev:web
  ```

  ### 5. Create initial users

  Create users in `auth.users` via the Supabase dashboard, then add matching rows in `users_profile` with the appropriate role assigned.

  ## Production

  Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel under Project Settings > Environment Variables. This key is server-only — never expose it to the client or commit it to git.

  ## Documentation

  Full documentation is in the [Wiki](https://github.com/disath-liyanage/3ds-system/wiki):

  - [Architecture](https://github.com/disath-liyanage/3ds-system/wiki/Architecture) - Tech stack, monorepo structure, design decisions
  - [Database & Roles](https://github.com/disath-liyanage/3ds-system/wiki/Roles) - Schema overview and role permissions
  - [Features](https://github.com/disath-liyanage/3ds-system/wiki/Features) - Full feature breakdown

  ---

  <div align="center">
    <sub>Copyright &copy; 2026 Disath Liyanage. All Rights Reserved.</sub>
  </div>