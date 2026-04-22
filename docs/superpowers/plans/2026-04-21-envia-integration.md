# Envia.com Integration - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Envia.com as national shipping provider for all Colombian cities except Barranquilla, with dual-carrier quoting (Coordinadora + Deprisa), automatic label generation, pickup scheduling, webhook tracking, and transactional emails.

**Architecture:** Extends the existing delivery infrastructure (delivery_settings, lib/delivery.ts, emails). New `lib/envia.ts` client wraps the Envia API. Checkout detects non-Barranquilla cities and quotes via Envia. Post-payment triggers label generation + pickup. Webhook receiver maps Envia statuses to order states.

**Tech Stack:** Next.js App Router, Prisma, PostgreSQL, Envia.com REST API, Resend (emails)

**Spec:** `docs/superpowers/specs/2026-04-21-envia-integration-design.md`

---

## Task 1: Schema Changes

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Envia fields to DeliverySettings model**

In `prisma/schema.prisma`, update the `DeliverySettings` model. Remove `@unique` from `city` and add new fields after `availableDays`:

```prisma
model DeliverySettings {
  id              String   @id @default(uuid()) @db.Uuid
  city            String
  provider        String   @default("mensajeros_urbanos")
  enabled         Boolean  @default(true)
  muAccessToken   String   @default("") @map("mu_access_token")
  muWebhookToken  String   @default("") @map("mu_webhook_token")
  pickupAddress   String   @map("pickup_address")
  pickupCity      String   @map("pickup_city")
  pickupStoreId   String   @default("") @map("pickup_store_id")
  pickupStoreName String   @default("") @map("pickup_store_name")
  pickupPhone     String   @map("pickup_phone")
  timeSlots       Json     @default("[]") @map("time_slots")
  availableDays   Int      @default(7) @map("available_days")
  enviaApiToken   String?  @map("envia_api_token")
  enviaCarriers   Json?    @map("envia_carriers")
  enviaPickupStart String? @map("envia_pickup_start")
  enviaPickupEnd  String?  @map("envia_pickup_end")
  defaultWeight   Float?   @map("default_weight")
  defaultLength   Float?   @map("default_length")
  defaultWidth    Float?   @map("default_width")
  defaultHeight   Float?   @map("default_height")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@unique([city, provider])
  @@map("delivery_settings")
}
```

- [ ] **Step 2: Add shipping dimensions to Product model**

In the `Product` model, add after `isActive`:

```prisma
  shippingWeight  Float?   @map("shipping_weight")
  shippingLength  Float?   @map("shipping_length")
  shippingWidth   Float?   @map("shipping_width")
  shippingHeight  Float?   @map("shipping_height")
```

- [ ] **Step 3: Add Envia fields to Order model**

In the `Order` model, add after `muEta`:

```prisma
  enviaShipmentId       Int?     @map("envia_shipment_id")
  enviaCarrier          String?  @map("envia_carrier")
  enviaService          String?  @map("envia_service")
  enviaLabelUrl         String?  @map("envia_label_url")
  enviaDeliveryEstimate String?  @map("envia_delivery_estimate")
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add-envia-fields
```

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add Envia fields to schema (delivery_settings, products, orders)"
```

---

## Task 2: Envia Client Library

**Files:**
- Create: `lib/envia.ts`
- Create: `lib/__tests__/envia.test.ts`

- [ ] **Step 1: Write tests for Envia client**

Create `lib/__tests__/envia.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enviaRate, enviaGenerate, enviaTrack, enviaPickup, enviaCancel, enviaRegisterWebhook } from '../envia';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => { vi.resetAllMocks(); });

describe('enviaRate', () => {
  it('calls /ship/rate/ with correct payload and returns cheapest rate', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meta: 'rate',
        data: [{
          carrier: 'coordinadora',
          service: 'ground',
          serviceDescription: 'Terrestre',
          deliveryEstimate: '3-5 days',
          totalPrice: '18500',
          currency: 'COP',
        }],
      }),
    });

    const result = await enviaRate({
      apiToken: 'test-token',
      carrier: 'coordinadora',
      origin: { name: 'KPU', phone: '3001234567', street: 'Calle 72', city: 'Barranquilla', state: 'AT', country: 'CO', postalCode: '080001' },
      destination: { name: 'Juan', phone: '3009876543', street: 'Cra 7', city: 'Bogota', state: 'DC', country: 'CO', postalCode: '110111' },
      packages: [{ content: 'Cafe', weight: 0.5, length: 20, width: 15, height: 10, declaredValue: 50000 }],
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.envia.com/ship/rate/');
    expect(options.headers['Authorization']).toBe('Bearer test-token');
    expect(result.carrier).toBe('coordinadora');
    expect(result.totalPrice).toBe(18500);
  });

  it('throws on meta error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meta: 'error',
        error: { code: 400, message: 'Invalid postal code' },
      }),
    });

    await expect(enviaRate({
      apiToken: 'test-token',
      carrier: 'coordinadora',
      origin: { name: '', phone: '', street: '', city: '', state: '', country: 'CO', postalCode: '' },
      destination: { name: '', phone: '', street: '', city: '', state: '', country: 'CO', postalCode: '' },
      packages: [{ content: '', weight: 0.5, length: 20, width: 15, height: 10, declaredValue: 0 }],
    })).rejects.toThrow('Invalid postal code');
  });
});

describe('enviaGenerate', () => {
  it('calls /ship/generate/ and returns shipment data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meta: 'generate',
        data: [{
          carrier: 'coordinadora',
          service: 'ground',
          shipmentId: 166819,
          trackingNumber: '7072262094',
          trackUrl: 'https://tracking.envia.com/7072262094',
          label: 'https://files.envia.com/labels/7072262094.pdf',
          totalPrice: 18500,
          currency: 'COP',
        }],
      }),
    });

    const result = await enviaGenerate({
      apiToken: 'test-token',
      carrier: 'coordinadora',
      service: 'ground',
      origin: { name: 'KPU', phone: '3001234567', street: 'Calle 72', city: 'Barranquilla', state: 'AT', country: 'CO', postalCode: '080001' },
      destination: { name: 'Juan', phone: '3009876543', street: 'Cra 7', city: 'Bogota', state: 'DC', country: 'CO', postalCode: '110111' },
      packages: [{ content: 'Cafe', weight: 0.5, length: 20, width: 15, height: 10, declaredValue: 50000 }],
      orderReference: 'order-123',
    });

    expect(result.shipmentId).toBe(166819);
    expect(result.trackingNumber).toBe('7072262094');
    expect(result.labelUrl).toBe('https://files.envia.com/labels/7072262094.pdf');
    expect(result.trackUrl).toBe('https://tracking.envia.com/7072262094');
  });
});

describe('enviaTrack', () => {
  it('calls /ship/generaltrack/ and returns status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meta: 'track',
        data: [{
          trackingNumber: '7072262094',
          status: 'In transit',
          carrier: 'coordinadora',
          events: [{ timestamp: '2026-04-21T12:00:00Z', description: 'Shipment picked up' }],
        }],
      }),
    });

    const result = await enviaTrack({ apiToken: 'test-token', trackingNumbers: ['7072262094'] });
    expect(result[0].status).toBe('In transit');
    expect(result[0].trackingNumber).toBe('7072262094');
  });
});

describe('enviaPickup', () => {
  it('calls /ship/pickup/ with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ meta: 'pickup', data: { pickupId: 12345 } }),
    });

    await enviaPickup({
      apiToken: 'test-token',
      carrier: 'coordinadora',
      pickupDate: '2026-04-22',
      pickupTimeStart: '09:00',
      pickupTimeEnd: '17:00',
      pickupAddress: { name: 'KPU', phone: '3001234567', street: 'Calle 72', city: 'Barranquilla', state: 'AT', country: 'CO', postalCode: '080001' },
      trackingNumbers: ['7072262094'],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.carrier).toBe('coordinadora');
    expect(body.trackingNumbers).toEqual(['7072262094']);
  });
});

describe('enviaCancel', () => {
  it('calls /ship/cancel/ with tracking number', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ meta: 'cancel', data: { message: 'Cancelled' } }),
    });

    await enviaCancel({ apiToken: 'test-token', carrier: 'coordinadora', trackingNumber: '7072262094' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.carrier).toBe('coordinadora');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- lib/__tests__/envia.test.ts
```

Expected: FAIL — module `../envia` does not export the expected functions.

- [ ] **Step 3: Implement Envia client**

Create `lib/envia.ts`:

```typescript
const ENVIA_BASE = 'https://api.envia.com';
const ENVIA_QUERIES = 'https://queries.envia.com';

// --- Types ---

export interface EnviaAddress {
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface EnviaPackage {
  content: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  declaredValue: number;
}

export interface EnviaRateParams {
  apiToken: string;
  carrier: string;
  origin: EnviaAddress;
  destination: EnviaAddress;
  packages: EnviaPackage[];
}

export interface EnviaRateResult {
  carrier: string;
  service: string;
  serviceDescription: string;
  deliveryEstimate: string;
  totalPrice: number;
  currency: string;
}

export interface EnviaGenerateParams extends EnviaRateParams {
  service: string;
  orderReference?: string;
}

export interface EnviaGenerateResult {
  shipmentId: number;
  trackingNumber: string;
  trackUrl: string;
  labelUrl: string;
  totalPrice: number;
  carrier: string;
  service: string;
}

export interface EnviaTrackParams {
  apiToken: string;
  trackingNumbers: string[];
}

export interface EnviaTrackResult {
  trackingNumber: string;
  status: string;
  carrier: string;
  events: Array<{ timestamp: string; description: string; location?: string }>;
}

export interface EnviaPickupParams {
  apiToken: string;
  carrier: string;
  pickupDate: string;
  pickupTimeStart: string;
  pickupTimeEnd: string;
  pickupAddress: EnviaAddress;
  trackingNumbers: string[];
}

export interface EnviaCancelParams {
  apiToken: string;
  carrier: string;
  trackingNumber: string;
}

export interface EnviaWebhookParams {
  apiToken: string;
  url: string;
  typeId?: number;
}

// --- Error class ---

export class EnviaApiError extends Error {
  constructor(public code: number, message: string) {
    super(`Envia API error (${code}): ${message}`);
    this.name = 'EnviaApiError';
  }
}

// --- Shared helpers ---

async function enviaPost<T>(baseUrl: string, path: string, body: Record<string, unknown>, apiToken: string): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  // Envia returns HTTP 200 even on errors — must check meta field
  if (data.meta === 'error') {
    throw new EnviaApiError(data.error?.code || res.status, data.error?.message || 'Unknown error');
  }

  if (!res.ok) {
    throw new EnviaApiError(res.status, typeof data === 'string' ? data : JSON.stringify(data));
  }

  return data as T;
}

function buildAddress(addr: EnviaAddress) {
  return {
    name: addr.name,
    phone: addr.phone,
    street: addr.street,
    city: addr.city,
    state: addr.state,
    country: addr.country,
    postalCode: addr.postalCode,
  };
}

function buildPackages(pkgs: EnviaPackage[]) {
  return pkgs.map((p) => ({
    type: 'box',
    content: p.content,
    amount: 1,
    declaredValue: p.declaredValue,
    lengthUnit: 'CM',
    weightUnit: 'KG',
    weight: p.weight,
    dimensions: { length: p.length, width: p.width, height: p.height },
    additionalServices: [{ service: 'envia_insurance', data: { amount: String(p.declaredValue) } }],
  }));
}

// --- API Functions ---

export async function enviaRate(params: EnviaRateParams): Promise<EnviaRateResult> {
  const data = await enviaPost<any>(ENVIA_BASE, '/ship/rate/', {
    origin: buildAddress(params.origin),
    destination: buildAddress(params.destination),
    packages: buildPackages(params.packages),
    shipment: { type: 1, carrier: params.carrier },
    settings: { currency: 'COP' },
  }, params.apiToken);

  const rate = data.data[0];
  return {
    carrier: rate.carrier,
    service: rate.service,
    serviceDescription: rate.serviceDescription || '',
    deliveryEstimate: rate.deliveryEstimate || rate.deliveryDate?.dateDifference ? `${rate.deliveryDate.dateDifference} dias` : '',
    totalPrice: parseInt(rate.totalPrice, 10),
    currency: rate.currency || 'COP',
  };
}

export async function enviaGenerate(params: EnviaGenerateParams): Promise<EnviaGenerateResult> {
  const data = await enviaPost<any>(ENVIA_BASE, '/ship/generate/', {
    origin: buildAddress(params.origin),
    destination: buildAddress(params.destination),
    packages: buildPackages(params.packages),
    shipment: { type: 1, carrier: params.carrier, service: params.service, orderReference: params.orderReference },
    settings: { currency: 'COP', printFormat: 'PDF', printSize: 'PAPER_4X6' },
  }, params.apiToken);

  const shipment = data.data[0];
  return {
    shipmentId: shipment.shipmentId,
    trackingNumber: shipment.trackingNumber,
    trackUrl: shipment.trackUrl,
    labelUrl: shipment.label,
    totalPrice: shipment.totalPrice,
    carrier: shipment.carrier,
    service: shipment.service,
  };
}

export async function enviaTrack(params: EnviaTrackParams): Promise<EnviaTrackResult[]> {
  const data = await enviaPost<any>(ENVIA_BASE, '/ship/generaltrack/', {
    trackingNumbers: params.trackingNumbers,
  }, params.apiToken);

  return (data.data || []).map((item: any) => ({
    trackingNumber: item.trackingNumber,
    status: item.status,
    carrier: item.carrier,
    events: (item.events || []).map((e: any) => ({
      timestamp: e.timestamp,
      description: e.description,
      location: e.location,
    })),
  }));
}

export async function enviaPickup(params: EnviaPickupParams): Promise<void> {
  await enviaPost(ENVIA_BASE, '/ship/pickup/', {
    carrier: params.carrier,
    pickupDate: params.pickupDate,
    pickupTimeStart: params.pickupTimeStart,
    pickupTimeEnd: params.pickupTimeEnd,
    pickupAddress: buildAddress(params.pickupAddress),
    trackingNumbers: params.trackingNumbers,
  }, params.apiToken);
}

export async function enviaCancel(params: EnviaCancelParams): Promise<void> {
  await enviaPost(ENVIA_BASE, '/ship/cancel/', {
    carrier: params.carrier,
    trackingNumber: params.trackingNumber,
  }, params.apiToken);
}

export async function enviaRegisterWebhook(params: EnviaWebhookParams): Promise<void> {
  await enviaPost(ENVIA_QUERIES, '/webhooks', {
    type_id: params.typeId ?? 3,
    url: params.url,
    active: 1,
  }, params.apiToken);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- lib/__tests__/envia.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/envia.ts lib/__tests__/envia.test.ts
git commit -m "feat: add Envia.com API client library"
```

---

## Task 3: Envia Emails

**Files:**
- Modify: `lib/email.ts`

- [ ] **Step 1: Add Envia-specific email functions**

Add these functions at the end of `lib/email.ts`:

```typescript
// Email: Envia - Order Shipped with Carrier
export async function sendEnviaShippedEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
  carrier: string;
  trackingNumber: string;
  trackUrl: string;
  deliveryEstimate: string;
}): Promise<void> {
  const body = `
    ${orderHeader(data.orderId)}
    <tr>
      <td style="padding: 24px; background-color: white;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${data.customerName},</p>
        <p style="margin: 0 0 16px 0;">Tu pedido ha sido despachado y sera enviado con <strong>${data.carrier}</strong>.</p>
        <div style="background-color: #f9f9f9; padding: 16px; border-radius: 8px; margin: 0 0 24px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Transportadora:</strong> ${data.carrier}</p>
          <p style="margin: 0 0 8px 0;"><strong>Numero de guia:</strong> ${data.trackingNumber}</p>
          <p style="margin: 0;"><strong>Entrega estimada:</strong> ${data.deliveryEstimate}</p>
        </div>
        <p style="margin: 0 0 16px 0;"><a href="${data.trackUrl}" class="button">Rastrear envio</a></p>
        <p style="margin: 0;"><a href="https://kpucafe.com/pedido/${data.orderId}" class="button">Ver pedido</a></p>
      </td>
    </tr>
    ${emailFooter()}
  `;

  await send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${formatOrderId(data.orderId)} sera enviado con ${data.carrier}`,
    html: wrap(body),
  });
}

// Email: Envia - In Transit
export async function sendEnviaInTransitEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
  carrier: string;
  trackUrl: string;
}): Promise<void> {
  const body = `
    ${orderHeader(data.orderId)}
    <tr>
      <td style="padding: 24px; background-color: white;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${data.customerName},</p>
        <p style="margin: 0 0 24px 0;">Tu pedido va en camino con <strong>${data.carrier}</strong>.</p>
        <p style="margin: 0;"><a href="${data.trackUrl}" class="button">Rastrear envio</a></p>
      </td>
    </tr>
    ${emailFooter()}
  `;

  await send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${formatOrderId(data.orderId)} va en camino`,
    html: wrap(body),
  });
}

// Email: Envia - Out for Delivery
export async function sendEnviaOutForDeliveryEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
}): Promise<void> {
  const body = `
    ${orderHeader(data.orderId)}
    <tr>
      <td style="padding: 24px; background-color: white;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${data.customerName},</p>
        <p style="margin: 0 0 24px 0;"><strong>Tu pedido esta en reparto.</strong> Sera entregado hoy.</p>
        <p style="margin: 0;"><a href="https://kpucafe.com/pedido/${data.orderId}" class="button">Ver pedido</a></p>
      </td>
    </tr>
    ${emailFooter()}
  `;

  await send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${formatOrderId(data.orderId)} esta en reparto`,
    html: wrap(body),
  });
}
```

Note: `sendOrderDeliveredEmail` already exists and is reused for Envia deliveries too.

- [ ] **Step 2: Commit**

```bash
git add lib/email.ts
git commit -m "feat: add Envia transactional email functions"
```

---

## Task 4: Envia Quote API Route

**Files:**
- Create: `app/api/delivery/envia-quote/route.ts`

- [ ] **Step 1: Create envia-quote route**

Create `app/api/delivery/envia-quote/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enviaRate } from '@/lib/envia';

export async function POST(req: Request) {
  try {
    const { city, department, postalCode, address, items } = await req.json();

    if (!city || !address) {
      return NextResponse.json({ message: 'city y address son requeridos' }, { status: 400 });
    }

    const settings = await prisma.deliverySettings.findFirst({
      where: { provider: 'envia', enabled: true },
    });
    if (!settings || !settings.enviaApiToken) {
      return NextResponse.json({ available: false, reason: 'Envio nacional no disponible' });
    }

    const carriers: string[] = (settings.enviaCarriers as string[]) || ['coordinadora', 'deprisa'];

    // Calculate package from items
    let totalWeight = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;
    let totalValue = 0;

    if (items?.length) {
      for (const item of items) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        const qty = item.quantity || 1;
        const weight = product?.shippingWeight || settings.defaultWeight || 0.5;
        const length = product?.shippingLength || settings.defaultLength || 20;
        const width = product?.shippingWidth || settings.defaultWidth || 15;
        const height = product?.shippingHeight || settings.defaultHeight || 10;

        totalWeight += weight * qty;
        maxLength = Math.max(maxLength, length);
        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);
        totalValue += (item.unitPrice || 0) * qty;
      }
    } else {
      totalWeight = settings.defaultWeight || 0.5;
      maxLength = settings.defaultLength || 20;
      maxWidth = settings.defaultWidth || 15;
      maxHeight = settings.defaultHeight || 10;
    }

    const origin = {
      name: settings.pickupStoreName || 'KPU Cafe',
      phone: settings.pickupPhone,
      street: settings.pickupAddress,
      city: settings.pickupCity,
      state: 'AT', // Will be mapped from settings
      country: 'CO',
      postalCode: '080001',
    };

    const destination = {
      name: '',
      phone: '',
      street: address,
      city,
      state: department || '',
      country: 'CO',
      postalCode: postalCode || '',
    };

    const pkg = {
      content: 'Cafe especializado KPU',
      weight: totalWeight,
      length: maxLength,
      width: maxWidth,
      height: maxHeight,
      declaredValue: totalValue,
    };

    // Quote all carriers in parallel
    const ratePromises = carriers.map((carrier) =>
      enviaRate({ apiToken: settings.enviaApiToken!, carrier, origin, destination, packages: [pkg] })
        .catch(() => null)
    );

    const rates = (await Promise.all(ratePromises)).filter((r): r is NonNullable<typeof r> => r !== null);

    if (rates.length === 0) {
      return NextResponse.json({ available: false, reason: 'No hay cotizaciones disponibles' });
    }

    // Pick cheapest
    rates.sort((a, b) => a.totalPrice - b.totalPrice);
    const cheapest = rates[0];

    return NextResponse.json({
      available: true,
      shippingCost: cheapest.totalPrice,
      carrier: cheapest.carrier,
      service: cheapest.service,
      deliveryEstimate: cheapest.deliveryEstimate,
      allRates: rates.map((r) => ({
        carrier: r.carrier,
        service: r.service,
        totalPrice: r.totalPrice,
        deliveryEstimate: r.deliveryEstimate,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ available: false, reason: 'No se pudo cotizar el envio' });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/delivery/envia-quote/route.ts
git commit -m "feat: add Envia dual-carrier quote API route"
```

---

## Task 5: Envia Webhook Receiver

**Files:**
- Create: `app/api/delivery/envia-webhook/route.ts`

- [ ] **Step 1: Create envia webhook route**

Create `app/api/delivery/envia-webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';
import {
  sendEnviaInTransitEmail,
  sendEnviaOutForDeliveryEmail,
  sendOrderDeliveredEmail,
} from '@/lib/email';

function mapEnviaStatus(status: string): 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'returned' | null {
  const s = status.toLowerCase();
  if (s.includes('deliver') && !s.includes('out')) return 'delivered';
  if (s.includes('out for') || s.includes('reparto')) return 'out_for_delivery';
  if (s.includes('transit') || s.includes('transito') || s.includes('route')) return 'in_transit';
  if (s.includes('pick') || s.includes('recog')) return 'picked_up';
  if (s.includes('return') || s.includes('devuel')) return 'returned';
  if (s.includes('exception') || s.includes('fail') || s.includes('error')) return 'exception';
  return null;
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { trackingNumber, status, carrierName } = payload;

    log({
      level: 'info',
      type: 'delivery',
      action: 'envia_webhook_received',
      message: `Envia webhook: tracking=${trackingNumber} status=${status} carrier=${carrierName}`,
      metadata: payload,
    });

    if (!trackingNumber) {
      return NextResponse.json({ message: 'Missing trackingNumber' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { trackingNumber, deliveryMethod: 'envia' },
    });
    if (!order) {
      log({ level: 'warn', type: 'delivery', action: 'envia_webhook_order_not_found', message: `No order for tracking=${trackingNumber}` });
      return NextResponse.json({ message: 'OK' });
    }

    const user = order.userId
      ? await prisma.user.findUnique({ where: { id: order.userId } })
      : null;
    const baseEmailData = user?.email
      ? { to: user.email, orderId: order.id, customerName: order.shippingName }
      : null;

    const mapped = mapEnviaStatus(status);

    switch (mapped) {
      case 'picked_up':
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'picked_up' },
        });
        break;

      case 'in_transit':
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'in_transit', status: 'shipped' },
        });
        if (baseEmailData) {
          sendEnviaInTransitEmail({
            ...baseEmailData,
            carrier: order.enviaCarrier || carrierName || '',
            trackUrl: order.muTrackingUrl || '',
          }).catch(() => {});
        }
        break;

      case 'out_for_delivery':
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'out_for_delivery', status: 'shipped' },
        });
        if (baseEmailData) {
          sendEnviaOutForDeliveryEmail(baseEmailData).catch(() => {});
        }
        break;

      case 'delivered':
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'finished', status: 'delivered' },
        });
        if (baseEmailData) {
          sendOrderDeliveredEmail(baseEmailData).catch(() => {});
        }
        break;

      case 'exception':
      case 'returned':
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: mapped },
        });
        log({ level: 'warn', type: 'delivery', action: `envia_${mapped}`, message: `Envia ${mapped} for order ${order.id}`, metadata: payload });
        break;

      default:
        log({ level: 'info', type: 'delivery', action: 'envia_webhook_unmapped', message: `Unmapped Envia status: ${status}`, metadata: payload });
    }

    return NextResponse.json({ message: 'OK' });
  } catch (err: any) {
    log({ level: 'error', type: 'delivery', action: 'envia_webhook_error', message: err.message, error: err.stack });
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/delivery/envia-webhook/route.ts
git commit -m "feat: add Envia webhook receiver with status mapping and emails"
```

---

## Task 6: Extend Delivery Trigger for Envia

**Files:**
- Modify: `lib/delivery.ts`

- [ ] **Step 1: Add Envia trigger function**

Add imports at top of `lib/delivery.ts`:

```typescript
import { enviaGenerate, enviaPickup } from '@/lib/envia';
import { sendEnviaShippedEmail } from '@/lib/email';
```

Add this function after `triggerMuDeliveryIfNeeded`:

```typescript
export async function triggerEnviaDeliveryIfNeeded(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, user: true },
  });

  if (!order || order.deliveryMethod !== 'envia') return;

  const settings = await prisma.deliverySettings.findFirst({
    where: { provider: 'envia', enabled: true },
  });
  if (!settings || !settings.enviaApiToken) {
    await prisma.order.update({ where: { id: orderId }, data: { muStatus: 'error' } });
    log({ level: 'error', type: 'delivery', action: 'envia_not_configured', message: `Envia not configured`, metadata: { orderId } });
    return;
  }

  try {
    // Calculate package dimensions from order items
    let totalWeight = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    for (const item of order.items) {
      const qty = item.quantity;
      const w = item.product?.shippingWeight || settings.defaultWeight || 0.5;
      const l = item.product?.shippingLength || settings.defaultLength || 20;
      const wd = item.product?.shippingWidth || settings.defaultWidth || 15;
      const h = item.product?.shippingHeight || settings.defaultHeight || 10;
      totalWeight += w * qty;
      maxLength = Math.max(maxLength, l);
      maxWidth = Math.max(maxWidth, wd);
      maxHeight = Math.max(maxHeight, h);
    }

    const origin = {
      name: settings.pickupStoreName || 'KPU Cafe',
      phone: settings.pickupPhone,
      street: settings.pickupAddress,
      city: settings.pickupCity,
      state: 'AT',
      country: 'CO',
      postalCode: '080001',
    };

    const destination = {
      name: order.shippingName,
      phone: order.shippingPhone,
      street: order.shippingAddress,
      city: order.shippingCity,
      state: order.shippingDepartment || '',
      country: 'CO',
      postalCode: order.shippingPostalCode || '',
    };

    const carrier = order.enviaCarrier || 'coordinadora';
    const service = order.enviaService || 'ground';

    // Generate label
    const result = await enviaGenerate({
      apiToken: settings.enviaApiToken,
      carrier,
      service,
      origin,
      destination,
      packages: [{
        content: 'Cafe especializado KPU',
        weight: totalWeight,
        length: maxLength,
        width: maxWidth,
        height: maxHeight,
        declaredValue: order.total,
      }],
      orderReference: order.id,
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        enviaShipmentId: result.shipmentId,
        trackingNumber: result.trackingNumber,
        carrier: result.carrier,
        enviaLabelUrl: result.labelUrl,
        muTrackingUrl: result.trackUrl,
        muStatus: 'label_generated',
        status: 'preparing',
      },
    });

    log({ level: 'info', type: 'delivery', action: 'envia_label_generated', message: `Envia label generated for order ${orderId}`, metadata: { trackingNumber: result.trackingNumber, shipmentId: result.shipmentId } });

    // Schedule pickup
    try {
      const now = new Date();
      const pickupDate = now.toISOString().split('T')[0];

      await enviaPickup({
        apiToken: settings.enviaApiToken,
        carrier,
        pickupDate,
        pickupTimeStart: settings.enviaPickupStart || '09:00',
        pickupTimeEnd: settings.enviaPickupEnd || '17:00',
        pickupAddress: origin,
        trackingNumbers: [result.trackingNumber],
      });

      log({ level: 'info', type: 'delivery', action: 'envia_pickup_scheduled', message: `Pickup scheduled for order ${orderId}` });
    } catch (pickupErr: any) {
      log({ level: 'warn', type: 'delivery', action: 'envia_pickup_failed', message: `Pickup scheduling failed for order ${orderId}`, error: pickupErr.message });
    }

    // Send email
    if (order.user?.email) {
      sendEnviaShippedEmail({
        to: order.user.email,
        orderId: order.id,
        customerName: order.shippingName,
        carrier: result.carrier,
        trackingNumber: result.trackingNumber,
        trackUrl: result.trackUrl,
        deliveryEstimate: order.enviaDeliveryEstimate || '3-5 dias',
      }).catch(() => {});
    }
  } catch (err: any) {
    await prisma.order.update({ where: { id: orderId }, data: { muStatus: 'error' } });
    log({ level: 'error', type: 'delivery', action: 'envia_create_failed', message: `Failed to create Envia shipment for order ${orderId}`, error: err.message });
  }
}
```

- [ ] **Step 2: Add Envia trigger to payment routes**

In `app/api/payment-methods/charge-once/route.ts`, add import:
```typescript
import { triggerEnviaDeliveryIfNeeded } from '@/lib/delivery';
```

After the existing `triggerMuDeliveryIfNeeded(orderId).catch(() => {});` line, add:
```typescript
      triggerEnviaDeliveryIfNeeded(orderId).catch(() => {});
```

Do the same in `app/api/payment-methods/[id]/charge/route.ts` — add import and:
```typescript
      if (targetOrderId) triggerEnviaDeliveryIfNeeded(targetOrderId).catch(() => {});
```

- [ ] **Step 3: Commit**

```bash
git add lib/delivery.ts app/api/payment-methods/charge-once/route.ts app/api/payment-methods/[id]/charge/route.ts
git commit -m "feat: trigger Envia label generation and pickup after payment"
```

---

## Task 7: Admin Retry Envia Route

**Files:**
- Create: `app/api/admin/orders/[id]/retry-envia/route.ts`

- [ ] **Step 1: Create retry-envia route**

Create `app/api/admin/orders/[id]/retry-envia/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { triggerEnviaDeliveryIfNeeded } from '@/lib/delivery';
import { log } from '@/lib/logger';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ message: 'Pedido no encontrado' }, { status: 404 });
    if (order.deliveryMethod !== 'envia') {
      return NextResponse.json({ message: 'Este pedido no usa Envia' }, { status: 400 });
    }

    await triggerEnviaDeliveryIfNeeded(id);

    log({ level: 'info', type: 'delivery', action: 'envia_retry', message: `Envia retry for order ${id}`, userId: session.id });
    return NextResponse.json({ message: 'Envio Envia reintentado' });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/orders/[id]/retry-envia/
git commit -m "feat: add admin retry Envia API route"
```

---

## Task 8: Order Creation — Envia Fields

**Files:**
- Modify: `app/api/orders/route.ts`

- [ ] **Step 1: Add Envia fields to order creation**

In `app/api/orders/route.ts`, add these fields to the `tx.order.create` data block, after `scheduledDate`:

```typescript
          enviaCarrier: data.enviaCarrier || null,
          enviaService: data.enviaService || null,
          enviaDeliveryEstimate: data.enviaDeliveryEstimate || null,
```

- [ ] **Step 2: Commit**

```bash
git add app/api/orders/route.ts
git commit -m "feat: support enviaCarrier, enviaService, enviaDeliveryEstimate in order creation"
```

---

## Task 9: Checkout — Envia Integration

**Files:**
- Modify: `app/checkout/page.tsx`

- [ ] **Step 1: Add Envia state variables**

After the existing MU state variables, add:

```typescript
  // Envia delivery state
  const [enviaAvailable, setEnviaAvailable] = useState(false);
  const [enviaShippingCost, setEnviaShippingCost] = useState<number | null>(null);
  const [enviaCarrier, setEnviaCarrier] = useState('');
  const [enviaService, setEnviaService] = useState('');
  const [enviaDeliveryEstimate, setEnviaDeliveryEstimate] = useState('');
  const [enviaQuoteLoading, setEnviaQuoteLoading] = useState(false);
```

- [ ] **Step 2: Add Envia quote function**

After the `fetchMuQuote` function, add:

```typescript
  const fetchEnviaQuote = async (city: string, address: string, department: string, postalCode: string) => {
    if (city === 'Barranquilla' || !city || !address) {
      setEnviaAvailable(false);
      setEnviaShippingCost(null);
      return;
    }
    setEnviaQuoteLoading(true);
    try {
      const res = await fetch('/api/delivery/envia-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          department,
          postalCode,
          address,
          items: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.price,
          })),
        }),
      });
      const data = await res.json();
      if (data.available) {
        setEnviaAvailable(true);
        setEnviaShippingCost(data.shippingCost);
        setEnviaCarrier(data.carrier);
        setEnviaService(data.service);
        setEnviaDeliveryEstimate(data.deliveryEstimate);
      } else {
        setEnviaAvailable(false);
        setEnviaShippingCost(null);
      }
    } catch {
      setEnviaAvailable(false);
      setEnviaShippingCost(null);
    }
    setEnviaQuoteLoading(false);
  };
```

- [ ] **Step 3: Update useEffect for quote fetching**

Replace the existing `useEffect` that calls `fetchMuQuote`:

```typescript
  useEffect(() => {
    fetchMuQuote(form.city, form.address);
    fetchEnviaQuote(form.city, form.address, form.department, form.postalCode);
  }, [form.city, form.address, form.department, form.postalCode]);
```

- [ ] **Step 4: Update shipping cost calculation**

Replace the `shippingCost` calculation:

```typescript
  const shippingCost = totalPrice >= 100000
    ? 0
    : muAvailable && muShippingCost !== null
      ? muShippingCost
      : enviaAvailable && enviaShippingCost !== null
        ? enviaShippingCost
        : 12000;
```

- [ ] **Step 5: Update buildOrderPayload**

Update the `deliveryMethod` line and add Envia fields:

```typescript
      deliveryMethod: muAvailable ? 'mensajeros_urbanos' : enviaAvailable ? 'envia' : 'standard',
      shippingCost,
      scheduledDate: scheduledDateISO,
      enviaCarrier: enviaAvailable ? enviaCarrier : null,
      enviaService: enviaAvailable ? enviaService : null,
      enviaDeliveryEstimate: enviaAvailable ? enviaDeliveryEstimate : null,
```

- [ ] **Step 6: Add Envia badge in shipping step**

After the MU delivery options block, add:

```tsx
              {/* Envia Delivery Info */}
              {enviaAvailable && !muAvailable && (
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-foreground">Envio nacional con {enviaCarrier}</span>
                    {enviaQuoteLoading && <Loader2 className="h-4 w-4 animate-spin text-green-600" />}
                  </div>
                  {enviaShippingCost !== null && (
                    <p className="text-sm text-muted-foreground">
                      Costo: <span className="font-semibold text-foreground">${enviaShippingCost.toLocaleString('es-CO')}</span>
                      {enviaDeliveryEstimate && <span className="ml-2">— Entrega estimada: {enviaDeliveryEstimate}</span>}
                    </p>
                  )}
                </div>
              )}
```

- [ ] **Step 7: Add Envia badge in review step**

After the MU badge in the review step, add:

```tsx
                    {enviaAvailable && !muAvailable && (
                      <div className="flex items-center gap-2 py-2">
                        <Truck className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">Envio nacional con {enviaCarrier}</span>
                        {enviaDeliveryEstimate && (
                          <span className="text-xs text-muted-foreground">— Entrega: {enviaDeliveryEstimate}</span>
                        )}
                      </div>
                    )}
```

- [ ] **Step 8: Commit**

```bash
git add app/checkout/page.tsx
git commit -m "feat: add Envia quoting and carrier display to checkout"
```

---

## Task 10: Order Tracking — Envia States

**Files:**
- Modify: `app/pedido/[id]/order-status-poller.tsx`

- [ ] **Step 1: Add Envia status labels**

In the `MU_STATUS_CONFIG` map (or alongside it), add Envia-specific statuses:

```typescript
  label_generated: { label: 'Guia generada', color: 'text-blue-600' },
  picked_up: { label: 'Recogido por transportadora', color: 'text-blue-600' },
  in_transit: { label: 'En transito', color: 'text-primary' },
  out_for_delivery: { label: 'En reparto', color: 'text-orange-600' },
  exception: { label: 'Problema con envio', color: 'text-red-600' },
  returned: { label: 'Devuelto', color: 'text-red-600' },
```

- [ ] **Step 2: Add Envia tracking section**

In the MU tracking section JSX, extend the condition to also show for Envia orders. The section already checks `order.deliveryMethod === 'mensajeros_urbanos'`. Change it to also include `'envia'`:

```tsx
        {(['mensajeros_urbanos', 'envia'].includes(order.deliveryMethod || '')) && order.muStatus && (
```

Update the title inside to show the correct provider:

```tsx
              <span className="font-semibold text-foreground">
                {order.deliveryMethod === 'envia' ? `Envio nacional — ${order.enviaCarrier || 'Coordinadora'}` : 'Mensajeros Urbanos'}
              </span>
```

Add delivery estimate for Envia orders:

```tsx
            {order.deliveryMethod === 'envia' && order.enviaDeliveryEstimate && (
              <p className="text-sm text-muted-foreground">
                Entrega estimada: {order.enviaDeliveryEstimate}
              </p>
            )}
```

Add label download link for Envia:

```tsx
            {order.deliveryMethod === 'envia' && order.enviaLabelUrl && (
              <a href={order.enviaLabelUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/5 transition-colors">
                Descargar guia PDF
              </a>
            )}
```

- [ ] **Step 3: Pass Envia fields from page.tsx**

In `app/pedido/[id]/page.tsx`, ensure the `muData` prop passed to `OrderStatusPoller` also includes `enviaCarrier`, `enviaDeliveryEstimate`, `enviaLabelUrl` from the order.

- [ ] **Step 4: Commit**

```bash
git add app/pedido/[id]/order-status-poller.tsx app/pedido/[id]/page.tsx
git commit -m "feat: add Envia tracking states to order status page"
```

---

## Task 11: Admin Delivery Config — Envia Section

**Files:**
- Modify: `app/admin/configuracion/delivery/page.tsx`
- Modify: `app/api/admin/delivery-settings/route.ts`

- [ ] **Step 1: Update delivery settings API for provider field**

In `app/api/admin/delivery-settings/route.ts`, update the `PUT` handler to use `@@unique([city, provider])`:

Change `where: { city: data.city }` to:
```typescript
      where: { city_provider: { city: data.city, provider: data.provider } },
```

Add the new Envia fields to both `update` and `create` blocks:
```typescript
        enviaApiToken: data.enviaApiToken,
        enviaCarriers: data.enviaCarriers,
        enviaPickupStart: data.enviaPickupStart,
        enviaPickupEnd: data.enviaPickupEnd,
        defaultWeight: data.defaultWeight,
        defaultLength: data.defaultLength,
        defaultWidth: data.defaultWidth,
        defaultHeight: data.defaultHeight,
        provider: data.provider,
```

- [ ] **Step 2: Add Envia section to admin config page**

In `app/admin/configuracion/delivery/page.tsx`, add state for Envia config:

```typescript
const DEFAULT_ENVIA_CONFIG = {
  city: '__national__',
  provider: 'envia',
  enabled: false,
  pickupAddress: '',
  pickupCity: '',
  pickupPhone: '',
  pickupStoreName: '',
  enviaApiToken: '',
  enviaCarriers: ['coordinadora', 'deprisa'],
  enviaPickupStart: '09:00',
  enviaPickupEnd: '17:00',
  defaultWeight: 0.5,
  defaultLength: 20,
  defaultWidth: 15,
  defaultHeight: 10,
};
```

Add a second config state (`enviaConfig`) and fetch it from the settings array where `provider === 'envia'`. Add a new card section "Envia.com — Envios Nacionales" with:
- Toggle enabled/disabled
- API Token field (password)
- Carrier checkboxes (Coordinadora, Deprisa)
- Pickup address fields (can differ from MU)
- Pickup time window (start + end)
- Package fallback: weight, length, width, height
- Save button that calls PUT with `provider: 'envia'`

- [ ] **Step 3: Commit**

```bash
git add app/admin/configuracion/delivery/page.tsx app/api/admin/delivery-settings/route.ts
git commit -m "feat: add Envia configuration section to admin delivery page"
```

---

## Task 12: Admin Products — Shipping Dimensions

**Files:**
- Modify: `app/admin/productos/page.tsx`
- Modify: `app/api/admin/products/route.ts`
- Modify: `app/api/admin/products/[id]/route.ts`

- [ ] **Step 1: Add shipping fields to Product interface and form**

In `app/admin/productos/page.tsx`, add to the `Product` interface:
```typescript
  shipping_weight: number | null;
  shipping_length: number | null;
  shipping_width: number | null;
  shipping_height: number | null;
```

Add to `formData` state:
```typescript
    shipping_weight: 0,
    shipping_length: 0,
    shipping_width: 0,
    shipping_height: 0,
```

Add to the product mapping in `fetchAll`:
```typescript
        shipping_weight: p.shippingWeight,
        shipping_length: p.shippingLength,
        shipping_width: p.shippingWidth,
        shipping_height: p.shippingHeight,
```

- [ ] **Step 2: Add form fields in modal**

In the product edit/create modal, add a "Envio" section after the existing fields:

```tsx
                  {/* Shipping Dimensions */}
                  <div className="border-t pt-4 mt-4">
                    <label className="text-sm font-medium text-foreground mb-3 block flex items-center gap-2">
                      <Package className="h-4 w-4" />Dimensiones de envio (opcional)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Peso (kg)</label>
                        <input type="number" step="0.1" min="0" className={inputClass}
                          value={formData.shipping_weight || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_weight: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Largo (cm)</label>
                        <input type="number" step="1" min="0" className={inputClass}
                          value={formData.shipping_length || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_length: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Ancho (cm)</label>
                        <input type="number" step="1" min="0" className={inputClass}
                          value={formData.shipping_width || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_width: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Alto (cm)</label>
                        <input type="number" step="1" min="0" className={inputClass}
                          value={formData.shipping_height || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_height: parseFloat(e.target.value) || 0 })} />
                      </div>
                    </div>
                  </div>
```

- [ ] **Step 3: Include shipping fields in API calls**

Update the save/edit handler to include the new fields in the POST/PUT body:
```typescript
        shippingWeight: formData.shipping_weight || null,
        shippingLength: formData.shipping_length || null,
        shippingWidth: formData.shipping_width || null,
        shippingHeight: formData.shipping_height || null,
```

- [ ] **Step 4: Update product API routes**

In `app/api/admin/products/route.ts` POST handler, add to the `prisma.product.create` data:
```typescript
        shippingWeight: data.shippingWeight ?? null,
        shippingLength: data.shippingLength ?? null,
        shippingWidth: data.shippingWidth ?? null,
        shippingHeight: data.shippingHeight ?? null,
```

In `app/api/admin/products/[id]/route.ts` PATCH handler, add the same fields to the update data.

- [ ] **Step 5: Commit**

```bash
git add app/admin/productos/page.tsx app/api/admin/products/route.ts app/api/admin/products/[id]/route.ts
git commit -m "feat: add shipping dimensions to product management"
```

---

## Task 13: Admin Envios — Envia Section

**Files:**
- Modify: `app/admin/envios/page.tsx`

- [ ] **Step 1: Add Envia section**

In `app/admin/envios/page.tsx`, add to the Order interface:
```typescript
  envia_carrier: string | null;
  envia_label_url: string | null;
  envia_delivery_estimate: string | null;
```

Update the mapping in `fetchPendingShipments` to include:
```typescript
          envia_carrier: o.enviaCarrier,
          envia_label_url: o.enviaLabelUrl,
          envia_delivery_estimate: o.enviaDeliveryEstimate,
```

Add Envia order filtering:
```typescript
  const enviaOrders = orders.filter(o => o.delivery_method === 'envia');
```

Add a `retryEnvia` function:
```typescript
  const retryEnvia = async (orderId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/retry-envia`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Envio Envia reintentado' });
      fetchPendingShipments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };
```

Add new section after the MU section:

```tsx
      {/* Envia National Section */}
      <section>
        <h3 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-green-500" />Envios Nacionales — Envia ({enviaOrders.length})
        </h3>
        {enviaOrders.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay envios nacionales</p>
          </div>
        ) : (
          <div className="space-y-4">
            {enviaOrders.map(order => (
              <div key={order.id} className="bg-card rounded-xl p-6 shadow-soft border-l-4 border-green-500">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-medium text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        {order.envia_carrier || 'Envia'}
                      </span>
                      {order.tracking_number && (
                        <span className="text-xs text-muted-foreground">Guia: {order.tracking_number}</span>
                      )}
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground">{order.shipping_name}</p>
                          <p className="text-sm text-foreground">{order.shipping_address}</p>
                          <p className="text-sm text-foreground">{order.shipping_city}{order.shipping_department && `, ${order.shipping_department}`}</p>
                        </div>
                      </div>
                      {order.envia_delivery_estimate && (
                        <p className="text-sm text-muted-foreground">Entrega: {order.envia_delivery_estimate}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="font-display text-xl font-bold text-foreground text-right">${order.total.toLocaleString('es-CO')}</p>
                    {order.envia_label_url && (
                      <a href={order.envia_label_url} target="_blank" rel="noopener noreferrer"
                        className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium text-center">
                        Descargar guia
                      </a>
                    )}
                    {order.mu_tracking_url && (
                      <a href={order.mu_tracking_url} target="_blank" rel="noopener noreferrer"
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium text-center">
                        Ver tracking
                      </a>
                    )}
                    {order.mu_status === 'error' && (
                      <button onClick={() => retryEnvia(order.id)}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">
                        Reintentar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/envios/page.tsx
git commit -m "feat: add Envia national shipping section to admin envios"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "feat: complete Envia.com national shipping integration"
```
