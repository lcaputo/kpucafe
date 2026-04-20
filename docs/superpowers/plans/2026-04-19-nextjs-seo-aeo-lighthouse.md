# Next.js + SEO/AEO/Lighthouse Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate KPU Café from Vite SPA + NestJS to a Next.js App Router monolith with SSR/SSG, structured data, and Lighthouse 90+ scores.

**Architecture:** Next.js App Router with Server Components for public pages (homepage, products, plans), Client Components for interactive features (cart, checkout, admin). Prisma ORM called directly from Route Handlers and Server Components. Auth via httpOnly JWT cookies. ISR for homepage with 60s revalidation.

**Tech Stack:** Next.js 15, React 19, Prisma, Tailwind CSS, next/font, next/image, jsonwebtoken, bcrypt

---

## Phase 1: Next.js Project + Prisma + Auth

### Task 1: Initialize Next.js project

**Files:**
- Create: `next-app/` (new directory, will replace root later)
- Create: `next-app/package.json`
- Create: `next-app/next.config.ts`
- Create: `next-app/tsconfig.json`
- Create: `next-app/tailwind.config.ts`
- Create: `next-app/postcss.config.mjs`
- Create: `next-app/app/globals.css`

- [ ] **Step 1: Scaffold Next.js in next-app/**

```bash
npx create-next-app@latest next-app --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --no-turbopack
```

- [ ] **Step 2: Install dependencies**

```bash
cd next-app
npm install @prisma/client bcrypt jsonwebtoken jose axios class-variance-authority clsx tailwind-merge tailwindcss-animate lucide-react @radix-ui/react-toast @radix-ui/react-tooltip @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-checkbox @radix-ui/react-accordion @radix-ui/react-switch embla-carousel-react
npm install -D prisma @types/bcrypt @types/jsonwebtoken
```

- [ ] **Step 3: Copy Tailwind config from existing project**

Copy `tailwind.config.ts` from the root project. Update the `content` paths:

```ts
content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
```

- [ ] **Step 4: Copy globals.css**

Copy `src/index.css` to `next-app/app/globals.css`. Remove the `@import url(...)` for Google Fonts (will be replaced by next/font in Task 5). Keep all the `@layer base` CSS variables and custom classes.

- [ ] **Step 5: Verify build**

```bash
cd next-app && npm run build
```

Expected: Build succeeds with default page.

- [ ] **Step 6: Commit**

```bash
git add next-app/
git commit -m "feat: initialize Next.js project with Tailwind"
```

---

### Task 2: Set up Prisma

**Files:**
- Create: `next-app/prisma/schema.prisma`
- Create: `next-app/lib/prisma.ts`

- [ ] **Step 1: Copy Prisma schema**

Copy `backend/prisma/schema.prisma` to `next-app/prisma/schema.prisma`. Change the generator output to default (remove the `output` line if present):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Note: Next.js supports `url = env(...)` in the schema (unlike the Prisma 7 standalone config we had before).

- [ ] **Step 2: Create Prisma singleton**

```ts
// next-app/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 3: Create .env.local**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kpucafe
JWT_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-refresh-in-production
EPAYCO_PUBLIC_KEY=
EPAYCO_PRIVATE_KEY=
NEXT_PUBLIC_SITE_URL=https://kpucafe.com
```

- [ ] **Step 4: Generate Prisma client**

```bash
cd next-app && npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add next-app/prisma next-app/lib/prisma.ts next-app/.env.local
git commit -m "feat: add Prisma schema and client singleton"
```

---

### Task 3: Auth helpers (JWT + cookies)

**Files:**
- Create: `next-app/lib/auth.ts`

- [ ] **Step 1: Create auth utility**

```ts
// next-app/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret');
const JWT_REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET || 'dev-refresh');

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signAccessToken(payload: { sub: string; email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(JWT_SECRET);
}

export async function signRefreshToken(payload: { sub: string; email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_REFRESH_SECRET);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as { sub: string; email: string };
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET);
  return payload as { sub: string; email: string };
}

export function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = cookies();
  cookieStore.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60, // 15 minutes
  });
  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export function clearAuthCookies() {
  const cookieStore = cookies();
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');
}

/** Read the current user from cookies. Returns null if not authenticated. */
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;

  try {
    const payload = await verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: true, profile: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.role),
      profile: user.profile,
    };
  } catch {
    return null;
  }
}

/** Require auth or throw. For use in Route Handlers. */
export async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (!session.roles.includes('admin')) throw new Error('Forbidden');
  return session;
}
```

- [ ] **Step 2: Install jose (already in deps but verify)**

`jose` is used instead of `jsonwebtoken` because it works in Edge Runtime. Verify it's installed:

```bash
cd next-app && npm ls jose
```

If not: `npm install jose`

- [ ] **Step 3: Commit**

```bash
git add next-app/lib/auth.ts
git commit -m "feat: add JWT auth helpers with httpOnly cookies"
```

---

### Task 4: Auth Route Handlers

**Files:**
- Create: `next-app/app/api/auth/signup/route.ts`
- Create: `next-app/app/api/auth/signin/route.ts`
- Create: `next-app/app/api/auth/refresh/route.ts`
- Create: `next-app/app/api/auth/me/route.ts`
- Create: `next-app/app/api/auth/signout/route.ts`

- [ ] **Step 1: POST /api/auth/signup**

```ts
// next-app/app/api/auth/signup/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth';

export async function POST(req: Request) {
  const { email, password, fullName } = await req.json();

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ message: 'El email ya está registrado' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    return tx.user.create({
      data: {
        email,
        passwordHash,
        profile: { create: { fullName } },
        roles: { create: { role: 'user' } },
      },
      include: { roles: true, profile: true },
    });
  });

  const payload = { sub: user.id, email: user.email };
  const accessToken = await signAccessToken(payload);
  const refreshToken = await signRefreshToken(payload);

  setAuthCookies(accessToken, refreshToken);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.role),
      profile: user.profile,
    },
  });
}
```

- [ ] **Step 2: POST /api/auth/signin**

```ts
// next-app/app/api/auth/signin/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth';

export async function POST(req: Request) {
  const { email, password } = await req.json();

  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: true, profile: true },
  });

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return NextResponse.json({ message: 'Credenciales inválidas' }, { status: 401 });
  }

  const payload = { sub: user.id, email: user.email };
  const accessToken = await signAccessToken(payload);
  const refreshToken = await signRefreshToken(payload);

  setAuthCookies(accessToken, refreshToken);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.role),
      profile: user.profile,
    },
  });
}
```

- [ ] **Step 3: POST /api/auth/refresh**

```ts
// next-app/app/api/auth/refresh/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyRefreshToken, signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('refresh_token')?.value;
  if (!token) {
    return NextResponse.json({ message: 'No refresh token' }, { status: 401 });
  }

  try {
    const payload = await verifyRefreshToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: true, profile: true },
    });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 401 });
    }

    const newPayload = { sub: user.id, email: user.email };
    const accessToken = await signAccessToken(newPayload);
    const refreshToken = await signRefreshToken(newPayload);

    setAuthCookies(accessToken, refreshToken);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles.map((r) => r.role),
        profile: user.profile,
      },
    });
  } catch {
    return NextResponse.json({ message: 'Invalid refresh token' }, { status: 401 });
  }
}
```

- [ ] **Step 4: GET /api/auth/me**

```ts
// next-app/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json(session);
}
```

- [ ] **Step 5: POST /api/auth/signout**

```ts
// next-app/app/api/auth/signout/route.ts
import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth';

export async function POST() {
  clearAuthCookies();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Commit**

```bash
git add next-app/app/api/auth/
git commit -m "feat: add auth Route Handlers (signup/signin/refresh/me/signout)"
```

---

### Task 5: Root layout with next/font, metadata, providers

**Files:**
- Create: `next-app/app/layout.tsx`
- Create: `next-app/components/providers.tsx`
- Create: `next-app/lib/api.ts`

- [ ] **Step 1: Create root layout with next/font and global metadata**

```tsx
// next-app/app/layout.tsx
import type { Metadata } from 'next';
import { Open_Sans, Paytone_One } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  display: 'swap',
});

const paytoneOne = Paytone_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-paytone-one',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://kpucafe.com'),
  title: {
    default: 'KPU Café — Café de Especialidad Colombiano',
    template: '%s | KPU Café',
  },
  description: 'Café de especialidad 100% arábica de las montañas del sur de Colombia. Envíos a toda Colombia. Suscripciones disponibles.',
  keywords: ['café colombiano', 'café de especialidad', 'café arábica', 'café en grano', 'suscripción café', 'KPU café'],
  authors: [{ name: 'KPU Café' }],
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'KPU Café',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@kpucafe',
  },
  robots: {
    index: true,
    follow: true,
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'KPU Café',
  url: 'https://kpucafe.com',
  logo: 'https://kpucafe.com/og-image.png',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+57-324-320-8547',
    contactType: 'customer service',
    areaServed: 'CO',
    availableLanguage: 'Spanish',
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Barranquilla',
    addressCountry: 'CO',
  },
  sameAs: [],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${openSans.variable} ${paytoneOne.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Update tailwind.config.ts font families to use CSS variables**

```ts
fontFamily: {
  sans: ["var(--font-open-sans)", "system-ui", "sans-serif"],
  display: ["var(--font-paytone-one)", "sans-serif"],
},
```

- [ ] **Step 3: Remove @import url() from globals.css**

Delete the line:
```css
@import url('https://fonts.googleapis.com/css2?family=Paytone+One&family=Open+Sans:wght@300;400;500;600;700&display=swap');
```

- [ ] **Step 4: Create providers wrapper (client component)**

```tsx
// next-app/components/providers.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ── Auth Context ──
interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  postal_code: string | null;
}

interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  profile: Profile | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  profile: Profile | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapProfile(p: any): Profile | null {
  if (!p) return null;
  return {
    id: p.id,
    user_id: p.userId,
    full_name: p.fullName,
    phone: p.phone,
    address: p.address,
    city: p.city,
    department: p.department,
    postal_code: p.postalCode,
  };
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser({ ...data, profile: mapProfile(data.profile) });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      });
      if (!res.ok) {
        const data = await res.json();
        return { error: new Error(data.message || 'Error al registrarse') };
      }
      const data = await res.json();
      setUser({ ...data.user, profile: mapProfile(data.user.profile) });
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message) };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        return { error: new Error(data.message || 'Credenciales inválidas') };
      }
      const data = await res.json();
      setUser({ ...data.user, profile: mapProfile(data.user.profile) });
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message) };
    }
  };

  const signOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAdmin: user?.roles?.includes('admin') ?? false,
      profile: user?.profile ?? null,
      signUp,
      signIn,
      signOut,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within Providers');
  return ctx;
}

// ── Cart Context ──
// Copy the CartContext from src/contexts/CartContext.tsx here
// (same localStorage-based cart, exported as useCart)

// ── Combined Providers ──
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add next-app/app/layout.tsx next-app/components/providers.tsx
git commit -m "feat: add root layout with next/font, metadata, Organization JSON-LD, auth provider"
```

---

## Phase 2: Public Pages (SSR) + SEO/AEO

### Task 6: Homepage as Server Component

**Files:**
- Create: `next-app/app/page.tsx`
- Create: `next-app/components/hero.tsx`
- Create: `next-app/components/products-section.tsx`
- Create: `next-app/components/product-card.tsx` (client)
- Create: `next-app/components/subscription-section.tsx`
- Create: `next-app/components/header.tsx` (client)
- Create: `next-app/components/footer.tsx`
- Create: `next-app/components/cart-drawer.tsx` (client)

- [ ] **Step 1: Create homepage (Server Component)**

```tsx
// next-app/app/page.tsx
import { prisma } from '@/lib/prisma';
import Header from '@/components/header';
import Hero from '@/components/hero';
import ProductsSection from '@/components/products-section';
import SubscriptionSection from '@/components/subscription-section';
import Footer from '@/components/footer';
import CartDrawer from '@/components/cart-drawer';
import type { Metadata } from 'next';

export const revalidate = 60; // ISR: regenerate every 60 seconds

export const metadata: Metadata = {
  title: 'KPU Café — Café de Especialidad Colombiano',
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const [products, categories, plans] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { variants: { where: { isActive: true } }, category: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  // Product JSON-LD for AEO
  const productsJsonLd = products.map((p) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description || '',
    image: p.imageUrl || '',
    brand: { '@type': 'Brand', name: 'KPU Café' },
    offers: {
      '@type': 'Offer',
      price: p.basePrice,
      priceCurrency: 'COP',
      availability: 'https://schema.org/InStock',
      url: 'https://kpucafe.com/#productos',
    },
  }));

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'KPU Café',
    url: 'https://kpucafe.com',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productsJsonLd) }}
      />
      <div className="min-h-screen">
        <Header />
        <main>
          <Hero />
          <ProductsSection products={products} categories={categories} />
          <SubscriptionSection plans={plans} />
        </main>
        <Footer />
        <CartDrawer />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Port Hero component**

Copy `src/components/Hero.tsx` to `next-app/components/hero.tsx`. Key changes:
- Replace `<img>` with `import Image from 'next/image'` and `<Image>` component
- Add `priority` to hero image (LCP optimization)
- Add `width`/`height` or `fill` prop
- Keep as Server Component (no `'use client'`)

- [ ] **Step 3: Port ProductsSection as Server Component**

Copy `src/components/ProductsSection.tsx` to `next-app/components/products-section.tsx`. Key changes:
- Remove `useState`, `useEffect`, `api` import — data passed as props from `page.tsx`
- Accept `products` and `categories` as props (already fetched on server)
- Keep category filtering logic but move it to a client sub-component for interactivity
- Remove loading spinner (SSR renders instantly)

- [ ] **Step 4: Port ProductCard as Client Component**

Copy `src/components/ProductCard.tsx` to `next-app/components/product-card.tsx`. Add `'use client'` directive. Replace `<img>` with `<Image>`.

- [ ] **Step 5: Port SubscriptionSection as Server Component**

Copy `src/components/SubscriptionSection.tsx` to `next-app/components/subscription-section.tsx`. Remove data fetching — accept `plans` as props. Map camelCase Prisma fields directly (no more snake_case mapping needed).

- [ ] **Step 6: Port Header and Footer**

- Header: copy from `src/components/Header.tsx`, add `'use client'`, use `useAuth` from providers
- Footer: copy from `src/components/Footer.tsx`, replace `<img>` with `<Image>`, add LocalBusiness JSON-LD

- [ ] **Step 7: Port CartDrawer**

Copy from `src/components/CartDrawer.tsx`. Add `'use client'` directive. Use Next.js `useRouter` from `next/navigation` instead of `react-router-dom`.

- [ ] **Step 8: Copy shadcn/ui components**

Copy the `src/components/ui/` directory to `next-app/components/ui/`. Copy `lib/utils.ts`.

- [ ] **Step 9: Verify homepage renders with SSR**

```bash
cd next-app && npm run dev
```

Open `http://localhost:3000`, view page source → confirm HTML contains product names and prices (not empty div).

- [ ] **Step 10: Commit**

```bash
git add next-app/app/page.tsx next-app/components/
git commit -m "feat: add SSR homepage with products, plans, JSON-LD structured data"
```

---

### Task 7: Sitemap, robots.txt, web manifest

**Files:**
- Create: `next-app/app/sitemap.ts`
- Create: `next-app/app/robots.ts`
- Create: `next-app/app/manifest.ts`

- [ ] **Step 1: Dynamic sitemap**

```ts
// next-app/app/sitemap.ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://kpucafe.com';
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/auth`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];
}
```

- [ ] **Step 2: Programmatic robots.txt**

```ts
// next-app/app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/checkout', '/mis-pedidos', '/mis-suscripciones', '/pago-respuesta'],
      },
    ],
    sitemap: 'https://kpucafe.com/sitemap.xml',
  };
}
```

- [ ] **Step 3: Web app manifest**

```ts
// next-app/app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KPU Café — Café de Especialidad Colombiano',
    short_name: 'KPU Café',
    description: 'Café de especialidad 100% arábica de Colombia',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf8f5',
    theme_color: '#e8772e',
    icons: [
      { src: '/favicon.png', sizes: '192x192', type: 'image/png' },
    ],
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add next-app/app/sitemap.ts next-app/app/robots.ts next-app/app/manifest.ts
git commit -m "feat: add sitemap.xml, robots.txt, web manifest for SEO"
```

---

## Phase 3: User Pages + API Routes

### Task 8: Port remaining API Route Handlers

**Files:** Create one `route.ts` per endpoint in `next-app/app/api/`

- [ ] **Step 1: Products + Categories (public GET)**

Port logic from `backend/src/products/products.service.ts` and `backend/src/categories/categories.service.ts` into:
- `app/api/products/route.ts` (GET)
- `app/api/categories/route.ts` (GET)

Pattern for each: import `prisma`, query, return `NextResponse.json(data)`.

- [ ] **Step 2: Orders (user CRUD)**

Port from `backend/src/orders/orders.service.ts`:
- `app/api/orders/route.ts` (GET own orders, POST create order)
- `app/api/orders/[id]/items/route.ts` (GET items)

Use `requireAuth()` for auth. Filter by `session.id` for user's own orders.

- [ ] **Step 3: Shipping addresses**

- `app/api/shipping-addresses/route.ts` (GET, POST)
- `app/api/shipping-addresses/[id]/route.ts` (PATCH, DELETE)

- [ ] **Step 4: Coupons validation**

- `app/api/coupons/validate/route.ts` (POST)

- [ ] **Step 5: Subscriptions**

- `app/api/subscriptions/route.ts` (GET, POST)
- `app/api/subscriptions/[id]/route.ts` (PATCH)

- [ ] **Step 6: Subscription plans (public)**

- `app/api/subscription-plans/route.ts` (GET)

- [ ] **Step 7: Payments (ePayco)**

Port from `backend/src/payments/payments.service.ts`:
- `app/api/payments/epayco-key/route.ts` (GET)
- `app/api/payments/epayco-webhook/route.ts` (GET, POST) — faithfully port SHA-256 verification

- [ ] **Step 8: Uploads**

- `app/api/uploads/product-image/route.ts` (POST) — use `formData()` API in Next.js Route Handlers, write to `public/uploads/product-images/`

- [ ] **Step 9: Profiles**

- `app/api/profiles/me/route.ts` (GET, PATCH)

- [ ] **Step 10: Commit**

```bash
git add next-app/app/api/
git commit -m "feat: add all API Route Handlers (orders, payments, coupons, addresses, subscriptions, uploads, profiles)"
```

---

### Task 9: Port user-facing pages

**Files:**
- Create: `next-app/app/auth/page.tsx`
- Create: `next-app/app/checkout/page.tsx`
- Create: `next-app/app/pago-respuesta/page.tsx`
- Create: `next-app/app/mis-pedidos/page.tsx`
- Create: `next-app/app/mis-suscripciones/page.tsx`

- [ ] **Step 1: Port each page**

For each page, copy from existing `src/pages/`:
- Add `'use client'` directive
- Replace `react-router-dom` navigation with `next/navigation` (`useRouter`, `useSearchParams`, `Link`)
- Replace `api.get/post/patch/delete` calls with `fetch('/api/...')` (since cookies are sent automatically, no axios interceptor needed)
- Add page-specific metadata via `export const metadata` or `generateMetadata()` in a separate `layout.tsx` if needed
- Replace `<img>` with `<Image>` where applicable

Key metadata per page:
- `/auth`: `title: 'Iniciar sesión'`
- `/checkout`: `title: 'Finalizar compra'`, `robots: { index: false }`
- `/pago-respuesta`: `title: 'Estado del pago'`, `robots: { index: false }`
- `/mis-pedidos`: `title: 'Mis pedidos'`, `robots: { index: false }`
- `/mis-suscripciones`: `title: 'Mis suscripciones'`, `robots: { index: false }`

- [ ] **Step 2: Update Checkout confirmation URL**

In Checkout's `handlePayment`, change the confirmation URL from the NestJS endpoint to:

```ts
confirmation: `${window.location.origin}/api/payments/epayco-webhook`,
```

- [ ] **Step 3: Port useEpayco hook**

Copy `src/hooks/useEpayco.tsx`. Change the key fetch from `api.get('/payments/epayco-key')` to `fetch('/api/payments/epayco-key')`.

- [ ] **Step 4: Verify user flows**

```bash
cd next-app && npm run dev
```

Test: signup → login → browse products → add to cart → checkout → payment response → my orders.

- [ ] **Step 5: Commit**

```bash
git add next-app/app/auth next-app/app/checkout next-app/app/pago-respuesta next-app/app/mis-pedidos next-app/app/mis-suscripciones
git commit -m "feat: port user pages (auth, checkout, orders, subscriptions)"
```

---

## Phase 4: Admin Panel

### Task 10: Port admin pages + Route Handlers

**Files:**
- Create: `next-app/app/admin/layout.tsx`
- Create: `next-app/app/admin/page.tsx` (dashboard)
- Create: `next-app/app/admin/productos/page.tsx`
- Create: `next-app/app/admin/pedidos/page.tsx`
- Create: `next-app/app/admin/clientes/page.tsx`
- Create: `next-app/app/admin/envios/page.tsx`
- Create: `next-app/app/admin/suscripciones/page.tsx`
- Create: `next-app/app/admin/planes/page.tsx`
- Create: `next-app/app/admin/cupones/page.tsx`
- Create: `next-app/app/api/admin/` — all admin Route Handlers

- [ ] **Step 1: Create admin Route Handlers**

For each admin entity, create a route handler that uses `requireAdmin()`:
- `app/api/admin/products/route.ts` (GET all, POST)
- `app/api/admin/products/[id]/route.ts` (PATCH, DELETE)
- `app/api/admin/products/reorder/route.ts` (PATCH)
- `app/api/admin/products/[id]/variants/route.ts` (GET, POST)
- `app/api/admin/variants/[id]/route.ts` (PATCH, DELETE)
- `app/api/admin/orders/route.ts` (GET all)
- `app/api/admin/orders/[id]/route.ts` (PATCH, GET items)
- `app/api/admin/customers/route.ts` (GET)
- `app/api/admin/coupons/route.ts` (GET, POST)
- `app/api/admin/coupons/[id]/route.ts` (PATCH, DELETE)
- `app/api/admin/subscriptions/route.ts` (GET)
- `app/api/admin/subscriptions/[id]/route.ts` (PATCH)
- `app/api/admin/subscriptions/products/route.ts` (GET)
- `app/api/admin/subscription-plans/route.ts` (GET, POST)
- `app/api/admin/subscription-plans/[id]/route.ts` (PATCH, DELETE)
- `app/api/admin/subscription-plans/reorder/route.ts` (PATCH)
- `app/api/admin/dashboard/stats/route.ts` (GET)

Port logic directly from existing `backend/src/*/` services.

- [ ] **Step 2: Create admin layout**

```tsx
// next-app/app/admin/layout.tsx
'use client';

import { useAuth } from '@/components/providers';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
// Copy sidebar/navigation structure from existing AdminDashboard.tsx

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push('/');
  }, [user, isAdmin, loading, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user || !isAdmin) return null;

  return <>{children}</>;
}
```

- [ ] **Step 3: Port all admin pages**

Copy each admin page from `src/pages/admin/`. Key changes:
- Add `'use client'`
- Replace `api.*` calls with `fetch('/api/admin/...')`
- Replace react-router navigation with next/navigation
- Replace `<img>` with `<Image>`
- Port `ProductVariantsManager` component

- [ ] **Step 4: Verify admin panel**

```bash
cd next-app && npm run dev
```

Test: login as admin → navigate admin pages → CRUD products → manage orders.

- [ ] **Step 5: Commit**

```bash
git add next-app/app/admin/ next-app/app/api/admin/
git commit -m "feat: port admin panel with all CRUD Route Handlers"
```

---

## Phase 5: Lighthouse Polish + Cleanup

### Task 11: Image optimization + accessibility

**Files:**
- Modify: all components with `<img>` tags
- Modify: `next-app/app/layout.tsx`

- [ ] **Step 1: Audit and replace all remaining <img> tags**

```bash
cd next-app && grep -rn '<img' components/ app/ --include="*.tsx"
```

Replace each with `<Image>` from `next/image`. Set `width`/`height` or use `fill`. Add `priority` to hero image only.

- [ ] **Step 2: Add skip navigation link**

In `next-app/app/layout.tsx`, add before `<Providers>`:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground">
  Saltar al contenido
</a>
```

And in homepage `<main>`, add `id="main-content"`.

- [ ] **Step 3: Ensure semantic HTML**

- All sections have `aria-label`
- Single `<h1>` per page
- Navigation uses `<nav aria-label="...">`
- Footer uses `<footer>`

- [ ] **Step 4: Configure next/image domains**

```ts
// next-app/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'kpucafe.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: optimize images with next/image, add skip nav, semantic HTML"
```

---

### Task 12: Cleanup — remove old Vite + NestJS

**Files:**
- Delete: `backend/` directory
- Delete: `src/` directory (old Vite frontend)
- Delete: `vite.config.ts`, `postcss.config.js`, `eslint.config.js`, `components.json`, `index.html`
- Move: `next-app/*` to project root

- [ ] **Step 1: Move next-app to root**

```bash
# From project root
cp -r next-app/. ./next-app-tmp/
rm -rf src/ backend/ vite.config.ts postcss.config.js index.html components.json
mv next-app-tmp/* .
mv next-app-tmp/.* . 2>/dev/null
rm -rf next-app/ next-app-tmp/
```

- [ ] **Step 2: Update package.json**

The root `package.json` is now the Next.js one. Remove old Vite dependencies if any remain.

- [ ] **Step 3: Verify full build**

```bash
npm run build
```

Expected: Build succeeds, all pages generated.

- [ ] **Step 4: Run Lighthouse**

```bash
npm run dev
```

Open Chrome DevTools → Lighthouse → audit homepage for Performance, Accessibility, Best Practices, SEO.

Target: 90+ on all four categories.

- [ ] **Step 5: Update CLAUDE.md**

Update to reflect Next.js architecture:
- Commands: `npm run dev` (port 3000), `npm run build`, `npx prisma migrate dev`
- Architecture: Next.js App Router, Server Components, Route Handlers, Prisma direct
- Auth: httpOnly cookies, `getSession()` helper
- No more separate backend

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove Vite + NestJS, consolidate to Next.js monolith"
```

---

## Verification Checklist

After all tasks:

- [ ] `npm run build` succeeds with zero errors
- [ ] `view-source:` on homepage shows fully rendered HTML with product data
- [ ] `/sitemap.xml` returns valid sitemap
- [ ] `/robots.txt` has correct allow/disallow rules
- [ ] Page source contains JSON-LD (Organization, Product, WebSite)
- [ ] Google Rich Results Test validates structured data
- [ ] Lighthouse Performance ≥ 90
- [ ] Lighthouse Accessibility ≥ 90
- [ ] Lighthouse Best Practices ≥ 90
- [ ] Lighthouse SEO ≥ 90
- [ ] Auth flow works (signup → login → logout)
- [ ] Checkout + ePayco payment flow works
- [ ] Admin CRUD works
- [ ] No `supabase` or `vite` references remain in codebase
