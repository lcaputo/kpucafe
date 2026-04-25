# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KPU Cafe -- Colombian specialty coffee e-commerce platform with subscriptions, admin dashboard, and ePayco payment processing. All UI content is in Spanish. Domain: kpucafe.com

## Commands

```bash
npm run dev          # Next.js dev server on localhost:3000
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npx prisma migrate dev    # Run DB migrations
npx prisma generate       # Regenerate Prisma client
npx prisma studio         # DB GUI
```

## Architecture

**Stack**: Next.js (App Router), React, TypeScript, Tailwind CSS, Prisma, PostgreSQL.

**Path alias**: `@/*` maps to project root (app/, components/, lib/, etc.)

### Rendering strategy

- **Server Components** (default): Homepage, Hero, ProductsSection, SubscriptionSection, Footer. Data fetched via Prisma on the server. Zero client JS.
- **Client Components** (`'use client'`): Header, CartDrawer, ProductCard, Auth, Checkout, admin pages. Use browser APIs, hooks, interactivity.
- **ISR**: Homepage revalidates every 60 seconds.
- **Route Handlers** (`app/api/`): REST API replacing the old NestJS backend. Prisma called directly.

### Key layers

- **app/** -- Pages and API Route Handlers (Next.js App Router)
- **components/** -- Shared React components. `ui/` holds shadcn/ui primitives. `admin/` holds admin-specific components.
- **lib/** -- `prisma.ts` (Prisma singleton), `auth.ts` (JWT sign/verify, cookie helpers, getSession/requireAuth/requireAdmin), `utils.ts` (cn helper)
- **hooks/** -- `useEpayco.tsx` (ePayco payment widget), `use-toast.ts`, `use-mobile.tsx`
- **prisma/** -- `schema.prisma` with 12 tables and 4 enums

### Auth

JWT access token (15m) + refresh token (7d) stored in httpOnly cookies. Auth helpers in `lib/auth.ts`:
- `getSession()` -- reads cookie, returns user or null (for Server Components and Route Handlers)
- `requireAuth()` -- throws if not authenticated
- `requireAdmin()` -- throws if not admin
- `setAuthCookies()` / `clearAuthCookies()` -- manage cookies

Client-side auth via `useAuth()` from `components/providers.tsx` (fetches `/api/auth/me` on mount).

### Database (Prisma)

Schema in `prisma/schema.prisma`. Tables: `users`, `profiles`, `user_roles`, `products`, `product_variants`, `categories`, `orders`, `order_items`, `subscriptions`, `subscription_plans`, `coupons`, `shipping_addresses`. Enums: `AppRole`, `OrderStatus`, `SubscriptionFrequency`, `SubscriptionStatus`.

### Payment flow

Checkout -> `useEpayco` fetches key from `/api/payments/epayco-key` -> ePayco widget -> webhook at `/api/payments/epayco-webhook` (SHA-256 signature verification + ePayco API validation) -> order status updated -> frontend polls

### SEO/AEO

- Per-page metadata via Next.js Metadata API (title template, OG, Twitter)
- JSON-LD structured data: Organization (layout), Product (homepage), LocalBusiness (footer), WebSite (homepage)
- `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`
- `next/font` for render-blocking-free font loading
- `next/image` for automatic image optimization

## Environment Variables (.env.local)

- `DATABASE_URL` -- PostgreSQL connection string
- `JWT_SECRET`, `JWT_REFRESH_SECRET` -- JWT signing secrets
- `EPAYCO_PUBLIC_KEY`, `EPAYCO_PRIVATE_KEY` -- ePayco credentials
- `NEXT_PUBLIC_SITE_URL` -- Canonical site URL (https://kpucafe.com)
- `MU_BASE_URL` -- Mensajeros Urbanos API base URL (dev: `http://dev.api.mensajerosurbanos.com`)
- `MU_ENABLED`, `MU_ACCESS_TOKEN`, `MU_WEBHOOK_TOKEN` -- MU delivery toggle and credentials
- `MU_CITY`, `MU_PICKUP_ADDRESS`, `MU_PICKUP_CITY`, `MU_PICKUP_STORE_ID`, `MU_PICKUP_STORE_NAME`, `MU_PICKUP_PHONE` -- MU pickup config
- `MU_TIME_SLOTS` (JSON), `MU_AVAILABLE_DAYS` -- MU scheduling config
- `ENVIA_ENABLED`, `ENVIA_API_TOKEN` -- Envia toggle and credentials
- `ENVIA_CARRIERS` (JSON), `ENVIA_PICKUP_ADDRESS`, `ENVIA_PICKUP_CITY`, `ENVIA_PICKUP_PHONE`, `ENVIA_PICKUP_STORE_NAME` -- Envia pickup config
- `ENVIA_PICKUP_START`, `ENVIA_PICKUP_END` -- Envia pickup window
- `ENVIA_DEFAULT_WEIGHT`, `ENVIA_DEFAULT_LENGTH`, `ENVIA_DEFAULT_WIDTH`, `ENVIA_DEFAULT_HEIGHT` -- Envia package fallback dimensions

## Styling

Tailwind with custom KPU brand tokens in `tailwind.config.ts` and `app/globals.css`. Fonts: Open Sans (body, `--font-open-sans`), Paytone One (display, `--font-paytone-one`) via next/font. Dark mode via class strategy.
