# KPU Café: Migración a Next.js + SEO/AEO/Lighthouse

## Contexto

KPU Café es una SPA React (Vite) con backend NestJS + Prisma. El contenido se renderiza solo en el cliente, lo que impide que bots de búsqueda indexen productos, precios y planes de suscripción. No hay structured data, las imágenes no están optimizadas, y las fuentes se cargan con un @import CSS bloqueante. El objetivo es migrar todo a Next.js (App Router) para obtener SSR/SSG, eliminar NestJS, y optimizar para Google Lighthouse, SEO y AEO.

Dominio canónico: `https://kpucafe.com`

## Arquitectura

### Estructura del proyecto

```
kpucafe/
  app/
    layout.tsx              # RootLayout: fonts, metadata global, providers
    page.tsx                # Homepage (SSG): Hero + Products + Subscriptions
    auth/page.tsx           # Login/signup (client component)
    checkout/page.tsx       # Checkout flow (client component)
    pago-respuesta/page.tsx # Payment response (client component)
    mis-pedidos/page.tsx    # User orders (client, protected)
    mis-suscripciones/page.tsx
    admin/                  # Admin layout + pages (client, protected)
    api/
      auth/signup/route.ts
      auth/signin/route.ts
      auth/refresh/route.ts
      auth/me/route.ts
      products/route.ts
      categories/route.ts
      subscription-plans/route.ts
      orders/route.ts
      orders/[id]/items/route.ts
      coupons/validate/route.ts
      shipping-addresses/route.ts
      shipping-addresses/[id]/route.ts
      payments/epayco-key/route.ts
      payments/epayco-webhook/route.ts
      uploads/product-image/route.ts
      subscriptions/route.ts
      subscriptions/[id]/route.ts
      admin/...              # All admin CRUD routes
    sitemap.ts              # Dynamic sitemap
    robots.ts               # Programmatic robots.txt
    manifest.ts             # Web app manifest
  components/               # Shared React components (from src/components/)
  lib/
    prisma.ts               # Prisma client singleton
    auth.ts                 # JWT helpers (sign, verify, bcrypt)
    api.ts                  # Client-side axios instance
  prisma/
    schema.prisma           # Existing Prisma schema (from backend/)
  public/
    uploads/product-images/  # Static product images
  next.config.ts
  tailwind.config.ts
  .env.local
```

### Key decisions

- **Server Components by default**: Homepage, product listing, subscription plans render on the server. Zero JS shipped for those sections.
- **Client Components where needed**: Auth forms, cart, checkout, admin panel. Marked with `'use client'`.
- **Prisma direct from Route Handlers**: No separate backend. Route Handlers import Prisma directly. Auth middleware via a `getSession()` helper that reads the JWT cookie.
- **Cookies for auth**: Switch from localStorage tokens to httpOnly cookies. More secure and works with SSR (server can read the cookie during SSR to personalize).
- **Static generation for public pages**: Homepage, product catalog — regenerated via ISR (revalidate every 60s).

## SEO Optimizations

### Per-page metadata (Next.js Metadata API)

Each page exports a `metadata` or `generateMetadata()`:
- `title` with template: `%s | KPU Café — Café de Especialidad Colombiano`
- `description` unique per page
- `canonical` URL
- `openGraph` with image, title, description
- `twitter` card
- `alternates.canonical`

### sitemap.xml (dynamic)

`app/sitemap.ts` generates entries for:
- `/` (homepage)
- `/auth`
- Future product detail pages
- Priority and changeFrequency set per page type

### robots.txt (programmatic)

`app/robots.ts`:
- Allow all crawlers on public pages
- Disallow `/admin/*`, `/api/*`, `/checkout`, `/mis-pedidos`, `/mis-suscripciones`
- Reference sitemap URL

### URL structure

Keep current Spanish URLs (`/mis-pedidos`, `/pago-respuesta`). They're user-friendly and match the target audience.

## AEO (Answer Engine Optimization)

### JSON-LD Structured Data

Embedded in page `<head>` via Next.js metadata or `<script type="application/ld+json">`:

1. **Organization** (global, in layout):
   - name, url, logo, contactPoint, sameAs (social links)

2. **WebSite** (homepage):
   - name, url, potentialAction (SearchAction)

3. **Product** (on product cards, homepage):
   - name, description, image, offers (price, currency COP, availability)
   - brand: KPU Café

4. **BreadcrumbList** (all pages):
   - Inicio → [Current page]

5. **LocalBusiness** (footer/contact):
   - address, telephone, email

## Lighthouse Optimizations

### Performance

1. **next/image**: Replace all `<img>` with `<Image>` for automatic WebP/AVIF conversion, lazy loading, responsive srcset, priority on LCP image (hero).
2. **next/font**: Load Open Sans and Paytone One via `next/font/google` — eliminates render-blocking CSS @import, uses `font-display: swap`.
3. **Server Components**: Homepage sections (Hero, ProductsSection, SubscriptionSection) become Server Components fetching data on the server. Zero client JS for these sections.
4. **Code splitting**: Automatic via Next.js App Router. Admin pages only load when navigated to.
5. **ISR**: Homepage statically generated, revalidated every 60s. No loading spinners for first visit.

### Accessibility

1. Semantic HTML: `<main>`, `<nav>`, `<article>`, `<section>` with proper `aria-label`
2. All images get meaningful `alt` text
3. Color contrast preserved (existing palette is good)
4. Focus management on interactive elements
5. Skip navigation link

### Best Practices

1. HTTPS canonical URLs
2. No document.write
3. Proper `<meta viewport>`
4. No console errors

### SEO (Lighthouse SEO audit)

1. Meta description on every page
2. Proper heading hierarchy (single h1 per page)
3. Links have descriptive text
4. Images have alt attributes
5. Document has valid hreflang (es)
6. robots.txt valid
7. Structured data valid

## Migration strategy

### Phase 1: Next.js project + Prisma + Auth

1. Initialize Next.js project (App Router, TypeScript, Tailwind)
2. Copy Prisma schema, generate client
3. Create auth helpers (JWT sign/verify with cookies)
4. Create auth Route Handlers (signup/signin/refresh/me)
5. Port `useAuth` hook to work with cookies
6. Create `app/layout.tsx` with `next/font`, global metadata, providers

### Phase 2: Public pages (SSR) + SEO/AEO

1. Port Homepage as Server Component (fetch products, categories, plans on server)
2. Port Hero, ProductsSection, SubscriptionSection as Server Components
3. Port ProductCard, CartDrawer, Header as Client Components
4. Add JSON-LD structured data
5. Add per-page metadata
6. Add sitemap.ts and robots.ts

### Phase 3: User pages + Checkout + Payments

1. Port Auth page (client component)
2. Create remaining Route Handlers (orders, coupons, addresses, subscriptions, payments)
3. Port Checkout, PaymentResponse, MyOrders, MySubscriptions
4. Port useEpayco hook

### Phase 4: Admin panel

1. Port AdminDashboard layout + all admin pages
2. Create admin Route Handlers
3. Port file upload (using Next.js Route Handler with formidable/busboy)

### Phase 5: Lighthouse polish + cleanup

1. Replace all `<img>` with `next/image`
2. Optimize LCP (hero image priority, preload)
3. Add skip-navigation, aria-labels
4. Remove old Vite config, backend/ folder, old dependencies
5. Final Lighthouse audit and fixes

## Environment variables (.env.local)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kpucafe
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-refresh
EPAYCO_PUBLIC_KEY=
EPAYCO_PRIVATE_KEY=
NEXT_PUBLIC_SITE_URL=https://kpucafe.com
```

## Verification

After each phase:
- `npm run build` succeeds
- `npm run dev` renders pages correctly
- Lighthouse audit on homepage (target: 90+ on all 4 categories)
- Validate structured data with Google Rich Results Test
- Check `view-source:` on homepage shows rendered HTML (not empty div)
