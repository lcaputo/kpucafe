# Pagos Tokenizados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ePayco popup widget with direct card tokenization — custom CardForm, server-side ePayco client, payment methods CRUD, and rewritten checkout with saved-card support.

**Architecture:** `lib/epayco.ts` handles all ePayco REST calls (two-step JWT auth → tokenize/charge). Route Handlers in `app/api/payment-methods/` expose tokenize, save, list, delete, charge. `components/CardForm.tsx` + `hooks/useCardPayment.ts` replace `useEpayco`. Checkout becomes synchronous (no webhook polling).

**Tech Stack:** Next.js 16 App Router, Prisma 6, PostgreSQL, ePayco REST API (`api.secure.payco.co`), vitest (unit tests on pure functions), date-fns (already installed)

**Depends on:** Nothing. Run this plan first.  
**Follow-up:** `2026-04-21-suscripciones-plan.md` builds on top of this.

---

### Task 1: Schema migration — PaymentMethod + BillingRecord + Subscription fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new models and fields to schema**

Replace the `Subscription` model and add two new models. Open `prisma/schema.prisma` and make these changes:

After the `ShippingAddress` model (end of file), add:

```prisma
// -- Payment Methods --

model PaymentMethod {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  tokenId    String   @map("token_id")
  customerId String   @map("customer_id")
  franchise  String
  mask       String
  expMonth   String   @map("exp_month")
  expYear    String   @map("exp_year")
  cardHolder String   @map("card_holder")
  isDefault  Boolean  @default(false) @map("is_default")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscriptions  Subscription[]
  billingRecords BillingRecord[]

  @@map("payment_methods")
}

// -- Billing Records --

enum BillingStatus {
  approved
  rejected
  pending
  failed

  @@map("billing_status")
}

model BillingRecord {
  id              String        @id @default(uuid()) @db.Uuid
  subscriptionId  String        @map("subscription_id") @db.Uuid
  orderId         String?       @map("order_id") @db.Uuid
  paymentMethodId String        @map("payment_method_id") @db.Uuid
  amount          Int
  status          BillingStatus
  epaycoRef       String?       @map("epayco_ref")
  errorMessage    String?       @map("error_message")
  retryCount      Int           @default(0) @map("retry_count")
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamptz

  subscription  Subscription  @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  paymentMethod PaymentMethod @relation(fields: [paymentMethodId], references: [id])

  @@map("billing_records")
}
```

- [ ] **Step 2: Add new fields to the Subscription model**

In the `Subscription` model, add these fields after `shippingCity`:

```prisma
  planId          String?   @map("plan_id") @db.Uuid
  planName        String    @default("") @map("plan_name")
  paymentMethodId String?   @map("payment_method_id") @db.Uuid
```

And add these relations inside the `Subscription` model (after the existing `variant` relation):

```prisma
  plan          SubscriptionPlan? @relation(fields: [planId], references: [id], onDelete: SetNull)
  paymentMethod PaymentMethod?    @relation(fields: [paymentMethodId], references: [id])
  billingRecords BillingRecord[]
```

- [ ] **Step 3: Add back-relation to SubscriptionPlan**

In the `SubscriptionPlan` model, add:

```prisma
  subscriptions Subscription[]
```

- [ ] **Step 4: Add PaymentMethod back-relation to User**

In the `User` model, add:

```prisma
  paymentMethods PaymentMethod[]
```

- [ ] **Step 5: Run migration**

```bash
cd C:/Users/USER/Documents/GitHub/kpucafe
npx prisma migrate dev --name add_payment_methods_and_billing
```

Expected: migration file created, schema applied, Prisma client regenerated.

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | head -30
```

Expected: no Prisma type errors (may have other errors from missing files — OK for now).

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat: add PaymentMethod and BillingRecord tables, extend Subscription"
```

---

### Task 2: lib/epayco.ts — ePayco REST client

**Files:**
- Create: `lib/epayco.ts`

ePayco auth flow: `POST /v1/auth/login` → JWT → use with `Authorization: Bearer <jwt>` + `type: sdk-jwt` headers.

- [ ] **Step 1: Create the client**

Create `lib/epayco.ts`:

```typescript
const EPAYCO_BASE = 'https://api.secure.payco.co';
const TEST_MODE = process.env.EPAYCO_TEST_MODE === 'true';

export class EpaycoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EpaycoError';
  }
}

async function getJwt(): Promise<string> {
  const res = await fetch(`${EPAYCO_BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      public_key: process.env.EPAYCO_PUBLIC_KEY,
      private_key: process.env.EPAYCO_PRIVATE_KEY,
    }),
  });
  const raw = await res.json();
  const data = Array.isArray(raw) ? raw[0] : raw;
  const token =
    data?.bearer_token || data?.token || data?.bearer || data?.data?.bearer_token;
  if (!token) throw new EpaycoError('No se pudo autenticar con ePayco');
  return token;
}

function authHeaders(jwt: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
    type: 'sdk-jwt',
    lang: 'JAVASCRIPT',
  };
}

export async function tokenizeCard(card: {
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvc: string;
  cardHolder: string;
}): Promise<{ tokenId: string; franchise: string; mask: string }> {
  const jwt = await getJwt();
  const res = await fetch(`${EPAYCO_BASE}/v1/tokens`, {
    method: 'POST',
    headers: authHeaders(jwt),
    body: JSON.stringify({
      'card[number]': card.cardNumber.replace(/\s/g, ''),
      'card[exp_month]': card.expMonth.padStart(2, '0'),
      'card[exp_year]': card.expYear.length === 2 ? `20${card.expYear}` : card.expYear,
      'card[cvc]': card.cvc,
      'card[card_holder]': card.cardHolder,
      hasCvv: true,
      test: TEST_MODE,
    }),
  });
  if (!res.ok && res.status !== 200) {
    throw new EpaycoError(`ePayco tokenize HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.status === false) {
    const nested = data.data || {};
    const msg =
      nested.errors || nested.description || data.message ||
      'Tarjeta no válida. Verifica los datos e intenta de nuevo.';
    throw new EpaycoError(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  const token = data.data || data;
  return {
    tokenId: token.id || token.token_id || '',
    franchise: (token.franchise || '').toLowerCase(),
    mask: token.mask || '',
  };
}

export async function createCustomer(params: {
  tokenId: string;
  name: string;
  email: string;
  phone?: string;
  docType?: string;
  docNumber?: string;
}): Promise<{ customerId: string }> {
  const jwt = await getJwt();
  let phone = (params.phone || '0000000000').replace(/\D/g, '');
  if (phone.startsWith('57') && phone.length > 10) phone = phone.slice(2);

  const res = await fetch(`${EPAYCO_BASE}/payment/v1/customer/create`, {
    method: 'POST',
    headers: authHeaders(jwt),
    body: JSON.stringify({
      token_card: params.tokenId,
      name: params.name,
      email: params.email,
      doc_type: params.docType || 'CC',
      doc_number: params.docNumber || '0000000000',
      phone,
      default: true,
      test: TEST_MODE,
    }),
  });
  const data = await res.json();
  if (data.status === false) {
    throw new EpaycoError(data.message || 'Error al crear cliente ePayco');
  }
  const customerId = data.data?.customerId || data.customerId || '';
  if (!customerId) throw new EpaycoError('ePayco no devolvió customerId');
  return { customerId };
}

export interface ChargeResult {
  status: 'approved' | 'rejected' | 'pending';
  epaycoRef: string | null;
  transactionId: string | null;
  message: string;
}

export async function chargeCard(params: {
  tokenId: string;
  customerId: string;
  amount: number;
  description: string;
  invoiceNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  buyerAddress?: string;
  buyerCity?: string;
}): Promise<ChargeResult> {
  const jwt = await getJwt();
  let phone = (params.buyerPhone || '0000000000').replace(/\D/g, '');
  if (phone.startsWith('57') && phone.length > 10) phone = phone.slice(2);

  const res = await fetch(`${EPAYCO_BASE}/payment/v1/charge/create`, {
    method: 'POST',
    headers: authHeaders(jwt),
    body: JSON.stringify({
      token_card: params.tokenId,
      customer_id: params.customerId,
      doc_type: 'CC',
      doc_number: '0000000000',
      name: params.buyerName.split(' ')[0] || 'Cliente',
      last_name: params.buyerName.split(' ').slice(1).join(' ') || 'KPU',
      email: params.buyerEmail,
      phone,
      cell_phone: phone,
      address: params.buyerAddress || 'SIN DIRECCION',
      city: params.buyerCity || 'Colombia',
      department: 'Colombia',
      country: 'CO',
      bill: params.invoiceNumber,
      description: params.description,
      value: String(params.amount),
      tax: '0',
      tax_base: '0',
      currency: 'COP',
      dues: '1',
      test: TEST_MODE,
    }),
  });
  const data = await res.json();
  const tx = data.data || data;
  const estado = (tx.estado || tx.status || '').toLowerCase();
  let status: 'approved' | 'rejected' | 'pending';
  if (['aceptada', 'approved', 'aprobada'].includes(estado)) status = 'approved';
  else if (['pendiente', 'pending'].includes(estado)) status = 'pending';
  else status = 'rejected';

  return {
    status,
    epaycoRef: tx.ref_payco ? String(tx.ref_payco) : null,
    transactionId: tx.transactionID ? String(tx.transactionID) : null,
    message: tx.respuesta || tx.message || estado,
  };
}
```

- [ ] **Step 2: Add EPAYCO_TEST_MODE to .env.local**

```bash
echo "EPAYCO_TEST_MODE=true" >> .env.local
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "lib/epayco"
```

Expected: no errors from `lib/epayco.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/epayco.ts .env.local
git commit -m "feat: add ePayco REST client (tokenize, createCustomer, chargeCard)"
```

---

### Task 3: lib/billing.ts + vitest setup

**Files:**
- Create: `lib/billing.ts`
- Create: `vitest.config.ts`
- Create: `lib/__tests__/billing.test.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **Step 4: Write failing tests**

Create `lib/__tests__/billing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeNextBillingDate, mapEpaycoStatus } from '@/lib/billing';

describe('computeNextBillingDate', () => {
  it('adds 7 days for weekly', () => {
    const from = new Date('2026-04-21');
    const next = computeNextBillingDate(from, 'weekly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-04-28');
  });

  it('adds 14 days for biweekly', () => {
    const from = new Date('2026-04-21');
    const next = computeNextBillingDate(from, 'biweekly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-05-05');
  });

  it('adds 1 month for monthly', () => {
    const from = new Date('2026-04-21');
    const next = computeNextBillingDate(from, 'monthly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-05-21');
  });
});

describe('mapEpaycoStatus', () => {
  it('maps "Aceptada" to approved', () => {
    expect(mapEpaycoStatus('Aceptada')).toBe('approved');
  });
  it('maps "approved" to approved', () => {
    expect(mapEpaycoStatus('approved')).toBe('approved');
  });
  it('maps "Pendiente" to pending', () => {
    expect(mapEpaycoStatus('Pendiente')).toBe('pending');
  });
  it('maps "Rechazada" to rejected', () => {
    expect(mapEpaycoStatus('Rechazada')).toBe('rejected');
  });
  it('maps empty string to rejected', () => {
    expect(mapEpaycoStatus('')).toBe('rejected');
  });
});
```

- [ ] **Step 5: Run — verify FAIL**

```bash
npm test 2>&1 | tail -20
```

Expected: `Cannot find module '@/lib/billing'`

- [ ] **Step 6: Implement lib/billing.ts**

```typescript
import { addDays, addMonths } from 'date-fns';

export type SubscriptionFrequency = 'weekly' | 'biweekly' | 'monthly';
export type EpaycoChargeStatus = 'approved' | 'rejected' | 'pending';

export function computeNextBillingDate(
  from: Date,
  frequency: SubscriptionFrequency,
): Date {
  switch (frequency) {
    case 'weekly':   return addDays(from, 7);
    case 'biweekly': return addDays(from, 14);
    case 'monthly':  return addMonths(from, 1);
  }
}

export function mapEpaycoStatus(estado: string): EpaycoChargeStatus {
  const lower = estado.toLowerCase();
  if (['aceptada', 'approved', 'aprobada'].includes(lower)) return 'approved';
  if (['pendiente', 'pending'].includes(lower)) return 'pending';
  return 'rejected';
}
```

- [ ] **Step 7: Run — verify PASS**

```bash
npm test
```

Expected: `5 tests passed`

- [ ] **Step 8: Commit**

```bash
git add lib/billing.ts lib/__tests__/billing.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: add billing utilities and vitest setup"
```

---

### Task 4: POST /api/payment-methods/tokenize

**Files:**
- Create: `app/api/payment-methods/tokenize/route.ts`

This endpoint proxies card data to ePayco and returns only the token. Card fields never reach the DB.

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { tokenizeCard, EpaycoError } from '@/lib/epayco';

export async function POST(req: Request) {
  try {
    await requireAuth();
    const { cardNumber, expMonth, expYear, cvc, cardHolder } = await req.json();
    if (!cardNumber || !expMonth || !expYear || !cvc || !cardHolder) {
      return NextResponse.json({ message: 'Datos de tarjeta incompletos' }, { status: 400 });
    }
    const result = await tokenizeCard({ cardNumber, expMonth, expYear, cvc, cardHolder });
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof EpaycoError) {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep "payment-methods/tokenize"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/payment-methods/tokenize/route.ts
git commit -m "feat: add payment-methods/tokenize proxy endpoint"
```

---

### Task 5: GET + POST /api/payment-methods (list + save)

**Files:**
- Create: `app/api/payment-methods/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createCustomer, EpaycoError } from '@/lib/epayco';

// GET — list saved cards for current user
export async function GET() {
  try {
    const session = await requireAuth();
    const methods = await prisma.paymentMethod.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        franchise: true,
        mask: true,
        expMonth: true,
        expYear: true,
        cardHolder: true,
        isDefault: true,
        createdAt: true,
      },
    });
    return NextResponse.json(methods);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// POST — save a tokenized card (creates ePayco customer, stores in DB)
export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const { tokenId, franchise, mask, expMonth, expYear, cardHolder } = await req.json();
    if (!tokenId) return NextResponse.json({ message: 'tokenId requerido' }, { status: 400 });

    // Get profile for customer creation
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: { profile: true },
    });

    const { customerId } = await createCustomer({
      tokenId,
      name: user?.profile?.fullName || cardHolder || 'Cliente',
      email: user?.email || '',
      phone: user?.profile?.phone || undefined,
    });

    // Detect duplicate (same mask + franchise) → update token
    const existing = await prisma.paymentMethod.findFirst({
      where: { userId: session.id, mask, franchise },
    });

    let method;
    if (existing) {
      method = await prisma.paymentMethod.update({
        where: { id: existing.id },
        data: { tokenId, customerId, isDefault: true },
      });
    } else {
      // Mark all others as non-default
      await prisma.paymentMethod.updateMany({
        where: { userId: session.id },
        data: { isDefault: false },
      });
      method = await prisma.paymentMethod.create({
        data: {
          userId: session.id,
          tokenId,
          customerId,
          franchise: franchise || '',
          mask: mask || '',
          expMonth: expMonth || '',
          expYear: expYear || '',
          cardHolder: cardHolder || '',
          isDefault: true,
        },
      });
    }

    return NextResponse.json({
      id: method.id,
      franchise: method.franchise,
      mask: method.mask,
      expMonth: method.expMonth,
      expYear: method.expYear,
      isDefault: method.isDefault,
    });
  } catch (err: any) {
    if (err instanceof EpaycoError) return NextResponse.json({ message: err.message }, { status: 400 });
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/payment-methods/route.ts
git commit -m "feat: add payment-methods list and save endpoints"
```

---

### Task 6: DELETE + PATCH /api/payment-methods/[id]

**Files:**
- Create: `app/api/payment-methods/[id]/route.ts`
- Create: `app/api/payment-methods/[id]/default/route.ts`

- [ ] **Step 1: Create [id] route (DELETE)**

Create `app/api/payment-methods/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const method = await prisma.paymentMethod.findFirst({
      where: { id, userId: session.id },
    });
    if (!method) return NextResponse.json({ message: 'No encontrado' }, { status: 404 });

    await prisma.paymentMethod.delete({ where: { id } });

    // If no methods left, remove paymentMethodId from active subscriptions
    const remaining = await prisma.paymentMethod.count({ where: { userId: session.id } });
    if (remaining === 0) {
      await prisma.subscription.updateMany({
        where: { userId: session.id, status: { in: ['active', 'paused'] } },
        data: { paymentMethodId: null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create default route (PATCH)**

Create `app/api/payment-methods/[id]/default/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const method = await prisma.paymentMethod.findFirst({
      where: { id, userId: session.id },
    });
    if (!method) return NextResponse.json({ message: 'No encontrado' }, { status: 404 });

    await prisma.paymentMethod.updateMany({
      where: { userId: session.id },
      data: { isDefault: false },
    });
    await prisma.paymentMethod.update({
      where: { id },
      data: { isDefault: true },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/payment-methods/[id]/
git commit -m "feat: add payment-methods delete and set-default endpoints"
```

---

### Task 7: POST /api/payment-methods/[id]/charge + POST /api/payment-methods/charge-once

**Files:**
- Create: `app/api/payment-methods/[id]/charge/route.ts`
- Create: `app/api/payment-methods/charge-once/route.ts`

- [ ] **Step 1: Create saved-card charge endpoint**

Create `app/api/payment-methods/[id]/charge/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { chargeCard, EpaycoError } from '@/lib/epayco';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { amount, orderId } = await req.json();

    if (!amount || !orderId) {
      return NextResponse.json({ message: 'amount y orderId requeridos' }, { status: 400 });
    }

    const method = await prisma.paymentMethod.findFirst({
      where: { id, userId: session.id },
    });
    if (!method) return NextResponse.json({ message: 'Método de pago no encontrado' }, { status: 404 });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ message: 'Pedido no encontrado' }, { status: 404 });

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: { profile: true },
    });

    const result = await chargeCard({
      tokenId: method.tokenId,
      customerId: method.customerId,
      amount,
      description: `KPU Cafe - Pedido #${orderId.slice(0, 8)}`,
      invoiceNumber: orderId,
      buyerName: user?.profile?.fullName || method.cardHolder || 'Cliente',
      buyerEmail: user?.email || '',
      buyerPhone: user?.profile?.phone || undefined,
      buyerAddress: order.shippingAddress,
      buyerCity: order.shippingCity,
    });

    if (result.status === 'approved') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'paid', paymentReference: result.epaycoRef },
      });
    } else if (result.status === 'rejected') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });
    }

    return NextResponse.json({
      status: result.status,
      epaycoRef: result.epaycoRef,
      message: result.message,
    });
  } catch (err: any) {
    if (err instanceof EpaycoError) return NextResponse.json({ message: err.message }, { status: 400 });
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create charge-once endpoint (no DB save)**

Create `app/api/payment-methods/charge-once/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { tokenizeCard, createCustomer, chargeCard, EpaycoError } from '@/lib/epayco';

// Tokenize + create customer + charge without saving to DB
export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const { cardNumber, expMonth, expYear, cvc, cardHolder, amount, orderId } = await req.json();

    if (!cardNumber || !expMonth || !expYear || !cvc || !cardHolder || !amount || !orderId) {
      return NextResponse.json({ message: 'Datos incompletos' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ message: 'Pedido no encontrado' }, { status: 404 });

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: { profile: true },
    });

    const { tokenId, franchise, mask } = await tokenizeCard({ cardNumber, expMonth, expYear, cvc, cardHolder });
    const { customerId } = await createCustomer({
      tokenId,
      name: user?.profile?.fullName || cardHolder,
      email: user?.email || '',
      phone: user?.profile?.phone || undefined,
    });

    const result = await chargeCard({
      tokenId,
      customerId,
      amount,
      description: `KPU Cafe - Pedido #${orderId.slice(0, 8)}`,
      invoiceNumber: orderId,
      buyerName: user?.profile?.fullName || cardHolder,
      buyerEmail: user?.email || '',
      buyerPhone: user?.profile?.phone || undefined,
      buyerAddress: order.shippingAddress,
      buyerCity: order.shippingCity,
    });

    if (result.status === 'approved') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'paid', paymentReference: result.epaycoRef },
      });
    } else if (result.status === 'rejected') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });
    }

    return NextResponse.json({
      status: result.status,
      epaycoRef: result.epaycoRef,
      franchise,
      mask,
      message: result.message,
    });
  } catch (err: any) {
    if (err instanceof EpaycoError) return NextResponse.json({ message: err.message }, { status: 400 });
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/payment-methods/[id]/charge/ app/api/payment-methods/charge-once/
git commit -m "feat: add charge endpoints (saved card and one-time)"
```

---

### Task 8: CardForm component + useCardPayment hook

**Files:**
- Create: `components/CardForm.tsx`
- Create: `hooks/useCardPayment.ts`

- [ ] **Step 1: Create CardForm**

Create `components/CardForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';

export interface CardFormValues {
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvc: string;
  cardHolder: string;
}

export interface CardTokenResult {
  tokenId: string;
  franchise: string;
  mask: string;
  expMonth: string;
  expYear: string;
  cardHolder: string;
}

interface CardFormProps {
  onSuccess: (result: CardTokenResult) => void;
  onError?: (msg: string) => void;
  submitLabel?: string;
  loading?: boolean;
  showSaveOption?: boolean;
  saveCard?: boolean;
  onSaveCardChange?: (val: boolean) => void;
}

function formatCardNumber(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

export default function CardForm({
  onSuccess,
  onError,
  submitLabel = 'Pagar',
  loading = false,
  showSaveOption = false,
  saveCard = false,
  onSaveCardChange,
}: CardFormProps) {
  const [values, setValues] = useState({ cardNumber: '', expiry: '', cvc: '', cardHolder: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tokenizing, setTokenizing] = useState(false);

  const inputClass = (field: string) =>
    `w-full px-4 py-3 rounded-xl border ${
      errors[field] ? 'border-destructive ring-2 ring-destructive/20' : 'border-border'
    } bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all`;

  const validate = () => {
    const e: Record<string, string> = {};
    const digits = values.cardNumber.replace(/\s/g, '');
    if (digits.length < 13) e.cardNumber = 'Número de tarjeta inválido';
    if (!values.cardHolder.trim()) e.cardHolder = 'Nombre requerido';
    const expParts = values.expiry.split('/');
    if (expParts.length !== 2 || expParts[0].length !== 2 || expParts[1].length !== 2) {
      e.expiry = 'Vencimiento inválido (MM/AA)';
    }
    if (values.cvc.length < 3) e.cvc = 'CVC inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setTokenizing(true);
    try {
      const [expMonth, expYear] = values.expiry.split('/');
      const res = await fetch('/api/payment-methods/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: values.cardNumber.replace(/\s/g, ''),
          expMonth,
          expYear,
          cvc: values.cvc,
          cardHolder: values.cardHolder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al procesar tarjeta');
      onSuccess({ ...data, expMonth, expYear: `20${expYear}`, cardHolder: values.cardHolder });
    } catch (err: any) {
      const msg = err.message || 'Error al tokenizar tarjeta';
      setErrors({ cardNumber: msg });
      onError?.(msg);
    } finally {
      setTokenizing(false);
    }
  };

  const busy = loading || tokenizing;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Número de tarjeta
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={values.cardNumber}
            onChange={e => setValues(v => ({ ...v, cardNumber: formatCardNumber(e.target.value) }))}
            placeholder="1234 5678 9012 3456"
            className={inputClass('cardNumber')}
            maxLength={19}
          />
          <CreditCard className="absolute right-3 top-3.5 h-5 w-5 text-muted-foreground pointer-events-none" />
        </div>
        {errors.cardNumber && <p className="text-xs text-destructive mt-1">{errors.cardNumber}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Nombre en la tarjeta
        </label>
        <input
          type="text"
          value={values.cardHolder}
          onChange={e => setValues(v => ({ ...v, cardHolder: e.target.value.toUpperCase() }))}
          placeholder="NOMBRE APELLIDO"
          className={inputClass('cardHolder')}
        />
        {errors.cardHolder && <p className="text-xs text-destructive mt-1">{errors.cardHolder}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Vence (MM/AA)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={values.expiry}
            onChange={e => setValues(v => ({ ...v, expiry: formatExpiry(e.target.value) }))}
            placeholder="MM/AA"
            className={inputClass('expiry')}
            maxLength={5}
          />
          {errors.expiry && <p className="text-xs text-destructive mt-1">{errors.expiry}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">CVC</label>
          <input
            type="text"
            inputMode="numeric"
            value={values.cvc}
            onChange={e => setValues(v => ({ ...v, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            placeholder="123"
            className={inputClass('cvc')}
            maxLength={4}
          />
          {errors.cvc && <p className="text-xs text-destructive mt-1">{errors.cvc}</p>}
        </div>
      </div>

      {showSaveOption && (
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={saveCard}
            onChange={e => onSaveCardChange?.(e.target.checked)}
            className="rounded border-border"
          />
          Guardar tarjeta para futuras compras
        </label>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full btn-kpu flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create useCardPayment hook**

Create `hooks/useCardPayment.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';

export interface SavedPaymentMethod {
  id: string;
  franchise: string;
  mask: string;
  expMonth: string;
  expYear: string;
  cardHolder: string;
  isDefault: boolean;
}

export function useCardPayment() {
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);

  const fetchMethods = useCallback(async () => {
    setLoadingMethods(true);
    try {
      const res = await fetch('/api/payment-methods');
      if (res.ok) setSavedMethods(await res.json());
    } catch {
      // ignore — user may not be logged in
    } finally {
      setLoadingMethods(false);
    }
  }, []);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const saveCard = useCallback(async (token: {
    tokenId: string;
    franchise: string;
    mask: string;
    expMonth: string;
    expYear: string;
    cardHolder: string;
  }) => {
    const res = await fetch('/api/payment-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al guardar tarjeta');
    await fetchMethods();
    return data as SavedPaymentMethod;
  }, [fetchMethods]);

  const chargeSaved = useCallback(async (methodId: string, amount: number, orderId: string) => {
    const res = await fetch(`/api/payment-methods/${methodId}/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, orderId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al procesar pago');
    return data as { status: string; epaycoRef: string | null; message: string };
  }, []);

  const chargeNewCard = useCallback(async (card: {
    cardNumber: string;
    expMonth: string;
    expYear: string;
    cvc: string;
    cardHolder: string;
  }, amount: number, orderId: string) => {
    const res = await fetch('/api/payment-methods/charge-once', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...card, amount, orderId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al procesar pago');
    return data as { status: string; epaycoRef: string | null; franchise: string; mask: string };
  }, []);

  const deleteMethod = useCallback(async (id: string) => {
    await fetch(`/api/payment-methods/${id}`, { method: 'DELETE' });
    await fetchMethods();
  }, [fetchMethods]);

  const setDefault = useCallback(async (id: string) => {
    await fetch(`/api/payment-methods/${id}/default`, { method: 'PATCH' });
    await fetchMethods();
  }, [fetchMethods]);

  return {
    savedMethods,
    loadingMethods,
    fetchMethods,
    saveCard,
    chargeSaved,
    chargeNewCard,
    deleteMethod,
    setDefault,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add components/CardForm.tsx hooks/useCardPayment.ts
git commit -m "feat: add CardForm component and useCardPayment hook"
```

---

### Task 9: Checkout rewrite + pago-respuesta simplification

**Files:**
- Modify: `app/checkout/page.tsx`
- Modify: `app/pago-respuesta/page.tsx`

The key change: remove `useEpayco`, add payment method selection in step 3, make payment synchronous.

- [ ] **Step 1: Update checkout page**

In `app/checkout/page.tsx`:

1. Remove `import { useEpayco, EpaycoPaymentData } from '@/hooks/useEpayco';`

2. Add these imports:
```typescript
import CardForm, { CardTokenResult } from '@/components/CardForm';
import { useCardPayment, SavedPaymentMethod } from '@/hooks/useCardPayment';
```

3. Replace the `useEpayco` destructure:
```typescript
// Remove: const { isLoaded, isLoading: epaycoLoading, openCheckout } = useEpayco();
// Add:
const { savedMethods, loadingMethods, saveCard, chargeSaved, chargeNewCard, fetchMethods } = useCardPayment();
const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
const [showCardForm, setShowCardForm] = useState(false);
const [saveCardOption, setSaveCardOption] = useState(true);
```

4. Add a `useEffect` to initialize selected method and show card form:
```typescript
useEffect(() => {
  if (!loadingMethods && user) {
    if (savedMethods.length === 0) {
      setShowCardForm(true);
    } else {
      const def = savedMethods.find(m => m.isDefault) || savedMethods[0];
      setSelectedMethodId(def.id);
      setShowCardForm(false);
    }
  }
}, [savedMethods, loadingMethods, user]);
```

5. Replace `handlePayment` with this version (keep all address/order creation logic, replace the ePayco call):
```typescript
const handlePayment = async () => {
  if (!validateForm()) return;
  setIsProcessing(true);
  try {
    if (user && saveAddress && showNewAddress) {
      await fetch('/api/shipping-addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: addressLabel,
          fullName: form.fullName, phone: form.phone,
          address: form.address, city: form.city,
          department: form.department,
          postalCode: form.postalCode || null,
          isDefault: savedAddresses.length === 0,
        }),
      });
    }

    const orderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total: finalTotal,
        shippingName: form.fullName, shippingPhone: form.phone,
        shippingAddress: form.address, shippingCity: form.city,
        shippingDepartment: form.department,
        shippingPostalCode: form.postalCode,
        notes: form.notes,
        couponId: appliedCoupon?.id || null,
        discountAmount,
        items: items.map(item => ({
          productName: item.name, quantity: item.quantity,
          unitPrice: item.price,
          variantInfo: `${item.weight} - ${item.grind}`,
        })),
      }),
    });
    const order = await orderRes.json();
    if (!orderRes.ok) throw new Error(order.message || 'Error al crear pedido');

    // Payment with selected saved card
    if (selectedMethodId && !showCardForm) {
      const result = await chargeSaved(selectedMethodId, finalTotal, order.id);
      clearCart();
      router.push(`/pago-respuesta?status=${result.status}&orderId=${order.id}&ref=${result.epaycoRef || ''}`);
      return;
    }

    // Payment with new card — CardForm handles tokenization via onSuccess callback
    // We store the pending order id so the card form can use it
    setPendingOrderId(order.id);
    setPendingAmount(finalTotal);
    setTriggerCardSubmit(true);
  } catch (err: any) {
    toast({ title: 'Error', description: err.message, variant: 'destructive' });
  } finally {
    setIsProcessing(false);
  }
};
```

6. Add state variables for the card submit trigger:
```typescript
const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
const [pendingAmount, setPendingAmount] = useState(0);
const [triggerCardSubmit, setTriggerCardSubmit] = useState(false);
```

7. Add handler for when CardForm succeeds (called after tokenization):
```typescript
const handleCardTokenized = async (token: CardTokenResult) => {
  if (!pendingOrderId) return;
  setIsProcessing(true);
  setTriggerCardSubmit(false);
  try {
    let charge;
    if (saveCardOption && user) {
      const saved = await saveCard(token);
      charge = await chargeSaved(saved.id, pendingAmount, pendingOrderId);
    } else {
      charge = await chargeNewCard({
        cardNumber: token.tokenId, // We pass raw card from CardForm
        expMonth: token.expMonth, expYear: token.expYear,
        cvc: '', cardHolder: token.cardHolder,
      }, pendingAmount, pendingOrderId);
    }
    clearCart();
    router.push(`/pago-respuesta?status=${charge.status}&orderId=${pendingOrderId}&ref=${charge.epaycoRef || ''}`);
  } catch (err: any) {
    toast({ title: 'Error al pagar', description: err.message, variant: 'destructive' });
  } finally {
    setIsProcessing(false);
    setPendingOrderId(null);
  }
};
```

> **Note:** The CardForm's `onSuccess` callback receives the token (already tokenized). For the `charge-once` flow, we need to keep the raw card data. Refactor: hold raw card values in state and call the API directly. The simplest approach is to not use CardForm's internal submit for this — instead expose raw values via a ref. See alternative approach below.

**Alternative simpler approach** — skip the trigger mechanism and use CardForm purely for tokenization:

Replace the payment step (step === 'review') in the JSX with:

```tsx
{/* Payment method selection */}
{!showCardForm && savedMethods.length > 0 && (
  <div className="space-y-3">
    {savedMethods.map(m => (
      <div
        key={m.id}
        onClick={() => setSelectedMethodId(m.id)}
        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
          selectedMethodId === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
        }`}
      >
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          selectedMethodId === m.id ? 'border-primary bg-primary' : 'border-muted-foreground/40'
        }`}>
          {selectedMethodId === m.id && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>
        <CreditCard className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{m.franchise} •••• {m.mask.slice(-4)}</p>
          <p className="text-xs text-muted-foreground">Vence {m.expMonth}/{m.expYear}</p>
        </div>
      </div>
    ))}
    <button
      onClick={() => { setShowCardForm(true); setSelectedMethodId(null); }}
      className="flex items-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-sm text-muted-foreground hover:text-foreground"
    >
      <Plus className="h-4 w-4" />
      Usar otra tarjeta
    </button>
  </div>
)}

{showCardForm && (
  <>
    <CardForm
      onSuccess={handleCardTokenized}
      submitLabel={`Pagar $${finalTotal.toLocaleString('es-CO')}`}
      loading={isProcessing}
      showSaveOption={!!user}
      saveCard={saveCardOption}
      onSaveCardChange={setSaveCardOption}
    />
    {savedMethods.length > 0 && (
      <button
        onClick={() => { setShowCardForm(false); setSelectedMethodId(savedMethods[0].id); }}
        className="w-full mt-2 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        Usar tarjeta guardada
      </button>
    )}
  </>
)}

{!showCardForm && (
  <button
    onClick={handlePayment}
    disabled={isProcessing || loadingMethods || !selectedMethodId}
    className="w-full mt-6 btn-kpu flex items-center justify-center gap-2 disabled:opacity-50"
  >
    {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
    Pagar ${finalTotal.toLocaleString('es-CO')}
  </button>
)}
```

And update `handleCardTokenized` to use the token correctly:

```typescript
const handleCardTokenized = async (token: CardTokenResult) => {
  if (!pendingOrderId && !isProcessing) {
    // CardForm was submitted before order created — create order first
    await handlePaymentWithToken(token);
    return;
  }
};

const handlePaymentWithToken = async (token: CardTokenResult) => {
  setIsProcessing(true);
  try {
    // Create order
    const orderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total: finalTotal,
        shippingName: form.fullName, shippingPhone: form.phone,
        shippingAddress: form.address, shippingCity: form.city,
        shippingDepartment: form.department,
        shippingPostalCode: form.postalCode,
        notes: form.notes,
        couponId: appliedCoupon?.id || null,
        discountAmount,
        items: items.map(item => ({
          productName: item.name, quantity: item.quantity,
          unitPrice: item.price,
          variantInfo: `${item.weight} - ${item.grind}`,
        })),
      }),
    });
    const order = await orderRes.json();
    if (!orderRes.ok) throw new Error(order.message || 'Error al crear pedido');

    let charge;
    if (saveCardOption && user) {
      const saved = await saveCard(token);
      charge = await chargeSaved(saved.id, finalTotal, order.id);
    } else {
      // Use tokenId already obtained — but charge-once needs raw card data
      // So we call /api/payment-methods/[save then charge] approach:
      const saved = await saveCard(token); // saves temporarily
      charge = await chargeSaved(saved.id, finalTotal, order.id);
      if (!saveCardOption) {
        // Delete the temporarily saved card
        await fetch(`/api/payment-methods/${saved.id}`, { method: 'DELETE' });
      }
    }

    clearCart();
    router.push(`/pago-respuesta?status=${charge.status}&orderId=${order.id}&ref=${charge.epaycoRef || ''}`);
  } catch (err: any) {
    toast({ title: 'Error al pagar', description: err.message, variant: 'destructive' });
  } finally {
    setIsProcessing(false);
  }
};
```

Also remove `disabled={isProcessing || epaycoLoading || !isLoaded}` from the existing pay button — it no longer applies.

- [ ] **Step 2: Update pago-respuesta to handle direct status params**

In `app/pago-respuesta/page.tsx`, add this at the start of the `useEffect` in `PaymentResponse`:

```typescript
// Handle direct tokenized payment response (new flow)
const directStatus = searchParams.get('status');
if (directStatus && !searchParams.get('ref_payco') && !searchParams.get('x_cod_response')) {
  const statusMap: Record<string, PaymentStatus> = {
    approved: 'success',
    rejected: 'rejected',
    pending: 'pending',
  };
  const mappedStatus = statusMap[directStatus] || 'pending';
  const oid = searchParams.get('orderId');
  const ref = searchParams.get('ref');
  if (oid) setOrderId(oid);
  if (ref) setTransaction({
    ref_payco: ref,
    invoice: oid || '',
    description: 'KPU Cafe',
    amount: '0',
    currency: 'COP',
    status: directStatus,
    response: directStatus === 'approved' ? 'Aceptada' : directStatus,
    payment_method: 'Tarjeta',
  });
  setStatus(mappedStatus);
  if (mappedStatus === 'success') handleSuccess();
  return; // skip old ePayco params processing
}
```

Place this block at the very beginning of the `useEffect` body, before the existing `refPayco` check.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Fix any TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/checkout/page.tsx app/pago-respuesta/page.tsx
git commit -m "feat: rewrite checkout with tokenized card payment"
```

---

### Task 10: Remove legacy ePayco files

**Files:**
- Delete: `hooks/useEpayco.tsx`
- Delete: `app/api/payments/epayco-key/route.ts`
- Delete: `app/api/payments/epayco-webhook/route.ts`

- [ ] **Step 1: Delete files**

```bash
rm hooks/useEpayco.tsx
rm app/api/payments/epayco-key/route.ts
rm app/api/payments/epayco-webhook/route.ts
rmdir app/api/payments/epayco-key 2>/dev/null || true
rmdir app/api/payments/epayco-webhook 2>/dev/null || true
```

- [ ] **Step 2: Check for remaining imports**

```bash
grep -r "useEpayco\|epayco-key\|epayco-webhook" app/ components/ hooks/ --include="*.ts" --include="*.tsx"
```

Expected: no results.

- [ ] **Step 3: Final build**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove legacy ePayco widget files"
```

---

**Plan 1 complete.** The checkout now uses tokenized card payments. Saved cards work. No more ePayco popup.

Next: run `2026-04-21-suscripciones-plan.md` to build the subscription module.
