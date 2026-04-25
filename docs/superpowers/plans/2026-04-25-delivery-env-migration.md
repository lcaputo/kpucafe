# Delivery Config: DB to Environment Variables Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace database-stored DeliverySettings with environment variables so MU and Envia configuration is managed via `.env.local` instead of the admin panel.

**Architecture:** Create a single `lib/delivery-config.ts` module that reads all delivery config from `process.env` and exports typed objects. Replace all `prisma.deliverySettings` queries across the codebase with imports from this module. Remove the admin delivery settings page, its API routes, and the DeliverySettings Prisma model.

**Tech Stack:** Next.js, TypeScript, Prisma

---

### Task 1: Create `lib/delivery-config.ts` — centralized env config reader

**Files:**
- Create: `lib/delivery-config.ts`

- [ ] **Step 1: Create the config module**

```ts
// lib/delivery-config.ts

export interface MuConfig {
  enabled: boolean;
  accessToken: string;
  webhookToken: string;
  city: string;
  pickupAddress: string;
  pickupCity: string;
  pickupStoreId: string;
  pickupStoreName: string;
  pickupPhone: string;
  timeSlots: Array<{ label: string; start: string; end: string }>;
  availableDays: number;
}

export interface EnviaConfig {
  enabled: boolean;
  apiToken: string;
  carriers: string[];
  pickupAddress: string;
  pickupCity: string;
  pickupPhone: string;
  pickupStoreName: string;
  pickupStart: string;
  pickupEnd: string;
  defaultWeight: number;
  defaultLength: number;
  defaultWidth: number;
  defaultHeight: number;
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function getMuConfig(): MuConfig {
  return {
    enabled: process.env.MU_ENABLED === 'true',
    accessToken: process.env.MU_ACCESS_TOKEN || '',
    webhookToken: process.env.MU_WEBHOOK_TOKEN || '',
    city: process.env.MU_CITY || 'Barranquilla',
    pickupAddress: process.env.MU_PICKUP_ADDRESS || '',
    pickupCity: process.env.MU_PICKUP_CITY || 'Barranquilla',
    pickupStoreId: process.env.MU_PICKUP_STORE_ID || '',
    pickupStoreName: process.env.MU_PICKUP_STORE_NAME || 'KPU Cafe',
    pickupPhone: process.env.MU_PICKUP_PHONE || '',
    timeSlots: parseJson(process.env.MU_TIME_SLOTS, [
      { label: '9:00 - 12:00', start: '09:00', end: '12:00' },
      { label: '12:00 - 15:00', start: '12:00', end: '15:00' },
      { label: '15:00 - 18:00', start: '15:00', end: '18:00' },
    ]),
    availableDays: parseInt(process.env.MU_AVAILABLE_DAYS || '7', 10),
  };
}

export function getEnviaConfig(): EnviaConfig {
  return {
    enabled: process.env.ENVIA_ENABLED === 'true',
    apiToken: process.env.ENVIA_API_TOKEN || '',
    carriers: parseJson(process.env.ENVIA_CARRIERS, ['coordinadora', 'deprisa']),
    pickupAddress: process.env.ENVIA_PICKUP_ADDRESS || '',
    pickupCity: process.env.ENVIA_PICKUP_CITY || '',
    pickupPhone: process.env.ENVIA_PICKUP_PHONE || '',
    pickupStoreName: process.env.ENVIA_PICKUP_STORE_NAME || 'KPU Cafe',
    pickupStart: process.env.ENVIA_PICKUP_START || '09:00',
    pickupEnd: process.env.ENVIA_PICKUP_END || '17:00',
    defaultWeight: parseFloat(process.env.ENVIA_DEFAULT_WEIGHT || '0.5'),
    defaultLength: parseFloat(process.env.ENVIA_DEFAULT_LENGTH || '20'),
    defaultWidth: parseFloat(process.env.ENVIA_DEFAULT_WIDTH || '15'),
    defaultHeight: parseFloat(process.env.ENVIA_DEFAULT_HEIGHT || '10'),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/delivery-config.ts
git commit -m "feat: add delivery-config.ts for env-based MU and Envia configuration"
```

---

### Task 2: Update `lib/delivery.ts` — replace Prisma queries with env config

**Files:**
- Modify: `lib/delivery.ts`

- [ ] **Step 1: Replace `triggerMuDeliveryIfNeeded`**

Remove the `prisma.deliverySettings.findFirst(...)` query. Import `getMuConfig` and use it:

```ts
import { getMuConfig, getEnviaConfig } from '@/lib/delivery-config';
```

Replace lines 22-27 (the settings query + enabled check) with:

```ts
const muConfig = getMuConfig();
if (!muConfig.enabled) {
  await prisma.order.update({ where: { id: orderId }, data: { muStatus: 'error' } });
  log({ level: 'error', type: 'delivery', action: 'mu_not_enabled', message: `MU not enabled`, metadata: { orderId } });
  return;
}
```

Then replace all `settings.muAccessToken` with `muConfig.accessToken`, `settings.pickupStoreId` with `muConfig.pickupStoreId`, `settings.pickupStoreName` with `muConfig.pickupStoreName`, `settings.pickupPhone` with `muConfig.pickupPhone`.

- [ ] **Step 2: Replace `triggerEnviaDeliveryIfNeeded`**

Remove the `prisma.deliverySettings.findFirst(...)` query (lines 100-102). Replace with:

```ts
const enviaConfig = getEnviaConfig();
if (!enviaConfig.enabled || !enviaConfig.apiToken) {
  await prisma.order.update({ where: { id: orderId }, data: { muStatus: 'error' } });
  log({ level: 'error', type: 'delivery', action: 'envia_not_configured', message: `Envia not configured`, metadata: { orderId } });
  return;
}
```

Replace all `settings.enviaApiToken` with `enviaConfig.apiToken`, `settings.defaultWeight` with `enviaConfig.defaultWeight`, etc. Replace `settings.pickupStoreName` with `enviaConfig.pickupStoreName`, `settings.pickupPhone` with `enviaConfig.pickupPhone`, `settings.pickupAddress` with `enviaConfig.pickupAddress`, `settings.pickupCity` with `enviaConfig.pickupCity`, `settings.enviaPickupStart` with `enviaConfig.pickupStart`, `settings.enviaPickupEnd` with `enviaConfig.pickupEnd`.

- [ ] **Step 3: Remove `import { prisma }` if no longer needed**

`prisma` is still needed for `prisma.order` queries — keep the import.

- [ ] **Step 4: Commit**

```bash
git add lib/delivery.ts
git commit -m "refactor: use env config instead of DB for delivery triggers"
```

---

### Task 3: Update `app/api/delivery/quote/route.ts` — MU quote

**Files:**
- Modify: `app/api/delivery/quote/route.ts`

- [ ] **Step 1: Replace DB query with env config**

Remove `import { prisma }` and the `prisma.deliverySettings.findFirst(...)` call. Import `getMuConfig` instead:

```ts
import { getMuConfig } from '@/lib/delivery-config';
```

Replace lines 20-23 with:

```ts
const muConfig = getMuConfig();
if (!muConfig.enabled) {
  return NextResponse.json({ available: false, reason: 'Delivery express no disponible en esta ciudad' });
}
```

Replace `settings.muAccessToken` with `muConfig.accessToken`, `settings.pickupAddress` with `muConfig.pickupAddress`, `settings.timeSlots` with `muConfig.timeSlots`, `settings.availableDays` with `muConfig.availableDays`.

- [ ] **Step 2: Commit**

```bash
git add app/api/delivery/quote/route.ts
git commit -m "refactor: MU quote route uses env config"
```

---

### Task 4: Update `app/api/delivery/envia-quote/route.ts` — Envia quote

**Files:**
- Modify: `app/api/delivery/envia-quote/route.ts`

- [ ] **Step 1: Replace DB query with env config**

Remove `import { prisma }` at top. Add:

```ts
import { getEnviaConfig } from '@/lib/delivery-config';
```

Replace lines 13-16 (the settings query) with:

```ts
const enviaConfig = getEnviaConfig();
if (!enviaConfig.enabled || !enviaConfig.apiToken) {
  return NextResponse.json({ available: false, reason: 'Envio nacional no disponible' });
}
```

Replace: `settings.enviaApiToken!` → `enviaConfig.apiToken`, `settings.enviaCarriers as string[]` → `enviaConfig.carriers`, `settings.pickupStoreName` → `enviaConfig.pickupStoreName`, `settings.pickupPhone` → `enviaConfig.pickupPhone`, `settings.pickupAddress` → `enviaConfig.pickupAddress`, `settings.pickupCity` → `enviaConfig.pickupCity`, `settings.defaultWeight` → `enviaConfig.defaultWeight`, `settings.defaultLength` → `enviaConfig.defaultLength`, `settings.defaultWidth` → `enviaConfig.defaultWidth`, `settings.defaultHeight` → `enviaConfig.defaultHeight`.

**Note:** `prisma` is still needed for `prisma.product.findUnique` inside the items loop — keep that import.

- [ ] **Step 2: Commit**

```bash
git add app/api/delivery/envia-quote/route.ts
git commit -m "refactor: Envia quote route uses env config"
```

---

### Task 5: Update `app/api/delivery/mu-webhook/route.ts` — webhook token validation

**Files:**
- Modify: `app/api/delivery/mu-webhook/route.ts`

- [ ] **Step 1: Replace DB token lookup with env config**

Remove the `prisma.deliverySettings.findFirst({ where: { muWebhookToken } })` call. Import `getMuConfig`:

```ts
import { getMuConfig } from '@/lib/delivery-config';
```

Replace lines 16-19 with:

```ts
const muConfig = getMuConfig();
if (!webhookToken || webhookToken !== muConfig.webhookToken) {
  return NextResponse.json({ message: 'Invalid webhook token' }, { status: 401 });
}
```

Remove `import { prisma }` only if no other prisma usage remains. (It's still used for `prisma.order` and `prisma.user` queries — keep it.)

- [ ] **Step 2: Commit**

```bash
git add app/api/delivery/mu-webhook/route.ts
git commit -m "refactor: MU webhook validates token from env"
```

---

### Task 6: Update admin order retry/cancel routes

**Files:**
- Modify: `app/api/admin/orders/[id]/retry-mu/route.ts`
- Modify: `app/api/admin/orders/[id]/cancel-mu/route.ts`

- [ ] **Step 1: Update retry-mu route**

Replace `prisma.deliverySettings.findFirst(...)` with `getMuConfig()`:

```ts
import { getMuConfig } from '@/lib/delivery-config';
```

Replace lines 27-30 with:

```ts
const muConfig = getMuConfig();
if (!muConfig.enabled) {
  return NextResponse.json({ message: 'Delivery no habilitado' }, { status: 400 });
}
```

Replace `settings.muAccessToken` → `muConfig.accessToken`, `settings.pickupStoreId` → `muConfig.pickupStoreId`.

- [ ] **Step 2: Update cancel-mu route**

Replace `prisma.deliverySettings.findFirst(...)` with `getMuConfig()`:

```ts
import { getMuConfig } from '@/lib/delivery-config';
```

Replace lines 19-20 with:

```ts
const muConfig = getMuConfig();
```

Replace `settings.muAccessToken` → `muConfig.accessToken`.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/orders/[id]/retry-mu/route.ts app/api/admin/orders/[id]/cancel-mu/route.ts
git commit -m "refactor: admin MU retry/cancel use env config"
```

---

### Task 7: Delete admin delivery settings page and API routes

**Files:**
- Delete: `app/admin/configuracion/delivery/page.tsx`
- Delete: `app/api/admin/delivery-settings/route.ts`
- Delete: `app/api/admin/delivery-settings/register-store/route.ts`
- Modify: `app/admin/layout.tsx` (remove sidebar link)

- [ ] **Step 1: Delete the admin delivery config page**

```bash
rm app/admin/configuracion/delivery/page.tsx
```

If the `app/admin/configuracion/delivery/` directory is now empty, delete it too.

- [ ] **Step 2: Delete the admin delivery-settings API routes**

```bash
rm -rf app/api/admin/delivery-settings/
```

- [ ] **Step 3: Remove sidebar link in `app/admin/layout.tsx`**

Remove the line:
```ts
{ path: '/admin/configuracion/delivery', icon: Truck, label: 'Delivery MU' },
```

Also remove the `Truck` import from `lucide-react` if no longer used elsewhere in the file.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove admin delivery settings UI and API (now env-based)"
```

---

### Task 8: Remove DeliverySettings from Prisma schema + create migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Remove the DeliverySettings model**

Delete the entire `model DeliverySettings { ... }` block (lines 399-428 in schema.prisma).

- [ ] **Step 2: Generate migration**

```bash
npx prisma migrate dev --name remove_delivery_settings
```

Expected: Migration drops the `delivery_settings` table.

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "refactor: remove DeliverySettings table from schema"
```

---

### Task 9: Add env vars to `.env.example` and verify build

**Files:**
- Modify: `.env.example` (or create if it doesn't exist)

- [ ] **Step 1: Add delivery env vars documentation**

Add to `.env.example`:

```bash
# -- Mensajeros Urbanos --
MU_BASE_URL=https://mu-integraciones.mensajerosurbanos.com
MU_ENABLED=false
MU_ACCESS_TOKEN=
MU_WEBHOOK_TOKEN=
MU_CITY=Barranquilla
MU_PICKUP_ADDRESS=
MU_PICKUP_CITY=Barranquilla
MU_PICKUP_STORE_ID=
MU_PICKUP_STORE_NAME=KPU Cafe
MU_PICKUP_PHONE=
MU_TIME_SLOTS=[{"label":"9:00 - 12:00","start":"09:00","end":"12:00"},{"label":"12:00 - 15:00","start":"12:00","end":"15:00"},{"label":"15:00 - 18:00","start":"15:00","end":"18:00"}]
MU_AVAILABLE_DAYS=7

# -- Envia.com --
ENVIA_ENABLED=false
ENVIA_API_TOKEN=
ENVIA_CARRIERS=["coordinadora","deprisa"]
ENVIA_PICKUP_ADDRESS=
ENVIA_PICKUP_CITY=
ENVIA_PICKUP_PHONE=
ENVIA_PICKUP_STORE_NAME=KPU Cafe
ENVIA_PICKUP_START=09:00
ENVIA_PICKUP_END=17:00
ENVIA_DEFAULT_WEIGHT=0.5
ENVIA_DEFAULT_LENGTH=20
ENVIA_DEFAULT_WIDTH=15
ENVIA_DEFAULT_HEIGHT=10
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build passes with no errors. No references to `deliverySettings` remain in any non-migration file.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add delivery env vars to .env.example"
```
