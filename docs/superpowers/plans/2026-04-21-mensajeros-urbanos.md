# Mensajeros Urbanos Integration - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Mensajeros Urbanos delivery API for Barranquilla orders with dynamic pricing, scheduled deliveries, real-time tracking, and transactional emails.

**Architecture:** Direct integration in the Next.js monolith. New `lib/mensajeros-urbanos.ts` client wraps MU API. `lib/email.ts` handles transactional emails via Resend. New `delivery_settings` table stores per-city config. MU webhook receiver updates order state and triggers emails. Checkout detects Barranquilla and shows dynamic quote + scheduling UI.

**Tech Stack:** Next.js App Router, Prisma, PostgreSQL, Resend (email), Mensajeros Urbanos REST API

**Spec:** `docs/superpowers/specs/2026-04-21-mensajeros-urbanos-integration-design.md`

---

## Task 1: Prisma Schema Changes

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add DeliverySettings model to schema**

Add after the `AppLog` model at the end of `prisma/schema.prisma`:

```prisma
// -- Delivery Settings --

model DeliverySettings {
  id              String   @id @default(uuid()) @db.Uuid
  city            String   @unique
  enabled         Boolean  @default(true)
  muAccessToken   String   @map("mu_access_token")
  muWebhookToken  String   @map("mu_webhook_token")
  pickupAddress   String   @map("pickup_address")
  pickupCity      String   @map("pickup_city")
  pickupStoreId   String   @map("pickup_store_id")
  pickupStoreName String   @map("pickup_store_name")
  pickupPhone     String   @map("pickup_phone")
  timeSlots       Json     @default("[]") @map("time_slots")
  availableDays   Int      @default(7) @map("available_days")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@map("delivery_settings")
}
```

- [ ] **Step 2: Add MU fields to Order model**

In the `Order` model, add these fields after `notes`:

```prisma
  deliveryMethod  String?  @map("delivery_method")
  shippingCost    Int?     @map("shipping_cost")
  scheduledDate   DateTime? @map("scheduled_date") @db.Timestamptz
  muUuid          String?  @map("mu_uuid")
  muTaskId        Int?     @map("mu_task_id")
  muStatus        String?  @map("mu_status")
  muDriverName    String?  @map("mu_driver_name")
  muDriverPhone   String?  @map("mu_driver_phone")
  muDriverPlate   String?  @map("mu_driver_plate")
  muTrackingUrl   String?  @map("mu_tracking_url")
  muEta           String?  @map("mu_eta")
```

- [ ] **Step 3: Add LogType 'delivery' to logger**

In `lib/logger.ts`, update the `LogType` type:

```typescript
export type LogType = 'auth' | 'order' | 'payment' | 'subscription' | 'admin' | 'system' | 'delivery';
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add-delivery-settings-and-mu-fields
```

Expected: Migration creates `delivery_settings` table and adds new columns to `orders`.

- [ ] **Step 5: Commit**

```bash
git add prisma/ lib/logger.ts
git commit -m "feat: add delivery_settings table and MU fields to orders schema"
```

---

## Task 2: Mensajeros Urbanos Client Library

**Files:**
- Create: `lib/mensajeros-urbanos.ts`
- Create: `lib/__tests__/mensajeros-urbanos.test.ts`

- [ ] **Step 1: Write tests for MU client**

Create `lib/__tests__/mensajeros-urbanos.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  muCalculate,
  muCreateService,
  muTrack,
  muCancel,
  muAddStore,
  muRegisterWebhook,
  MU_CITY_IDS,
} from '../mensajeros-urbanos';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('MU_CITY_IDS', () => {
  it('maps Barranquilla to 4', () => {
    expect(MU_CITY_IDS.Barranquilla).toBe(4);
  });
});

describe('muCalculate', () => {
  it('calls MU /api/calculate with correct payload and returns cost', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        total_service: 8500,
        total_distance: '5.2 km',
        base_value: 6000,
        distance_surcharge: 2000,
        insurance_surcharge: 500,
      }),
    });

    const result = await muCalculate({
      accessToken: 'test-token',
      cityId: 4,
      declaredValue: 50000,
      originAddress: 'Calle 72 #55-30, Barranquilla',
      destinationAddress: 'Calle 84 #42-15, Barranquilla',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://mu-integraciones.mensajerosurbanos.com/api/calculate');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.access_token).toBe('test-token');
    expect(body.type_service).toBe(4);
    expect(body.city).toBe(4);
    expect(body.declared_value).toBe(50000);

    expect(result.totalService).toBe(8500);
    expect(result.totalDistance).toBe('5.2 km');
  });

  it('throws on MU API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid token' }),
    });

    await expect(muCalculate({
      accessToken: 'bad-token',
      cityId: 4,
      declaredValue: 50000,
      originAddress: 'origin',
      destinationAddress: 'dest',
    })).rejects.toThrow('MU API error');
  });
});

describe('muCreateService', () => {
  it('calls MU /api/create and returns uuid + taskId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        task_id: 12345,
        uuid: 'abc-def-123',
        status: 2,
        total: 8500,
        distance: '5.2',
      }),
    });

    const result = await muCreateService({
      accessToken: 'test-token',
      cityId: 4,
      declaredValue: 50000,
      startDate: '2026-04-22',
      startTime: '09:00:00',
      storeId: 'kpu-baq-01',
      destination: {
        address: 'Calle 84 #42-15',
        orderId: 'order-123',
        description: 'Apto 301',
        clientName: 'Juan Perez',
        clientPhone: '3001234567',
        clientEmail: 'juan@test.com',
        paymentType: '3',
        productsValue: 50000,
        domicileValue: '8500',
      },
      products: [
        { storeId: 'kpu-baq-01', productName: 'Cafe Origen', quantity: 2, value: 25000 },
      ],
      observation: 'Cafe especial, fragil',
    });

    expect(result.uuid).toBe('abc-def-123');
    expect(result.taskId).toBe(12345);
    expect(result.total).toBe(8500);
  });
});

describe('muTrack', () => {
  it('calls MU /api/track and returns structured data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { task_id: 12345, status_id: 3, status: 'assigned' },
        resource: { name: 'Carlos', phone: '3009876543', plate_number: 'ABC123', type_resource_name: 'Motocicleta', photo: 'https://photo.url' },
        address: [{ address: 'Calle 84', status: 0 }],
        history: [{ status_id: 2, status: 'on_hold', date: '2026-04-21' }],
      }),
    });

    const result = await muTrack({ accessToken: 'test-token', uuid: 'abc-def-123' });

    expect(result.statusId).toBe(3);
    expect(result.statusName).toBe('assigned');
    expect(result.driver?.name).toBe('Carlos');
    expect(result.driver?.phone).toBe('3009876543');
    expect(result.driver?.plate).toBe('ABC123');
  });
});

describe('muCancel', () => {
  it('calls MU /api/cancel with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Service cancelled' }),
    });

    await muCancel({
      accessToken: 'test-token',
      uuid: 'abc-def-123',
      cancellationType: 3,
      description: 'Cliente cancelo',
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://mu-integraciones.mensajerosurbanos.com/api/cancel');
    const body = JSON.parse(options.body);
    expect(body.task_uuid).toBe('abc-def-123');
    expect(body.cancellation_type).toBe(3);
  });
});

describe('muAddStore', () => {
  it('calls MU /api/Add-store with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 999, message: 'Store created' }),
    });

    await muAddStore({
      accessToken: 'test-token',
      idPoint: 'kpu-baq-01',
      name: 'KPU Cafe Barranquilla',
      address: 'Calle 72 #55-30',
      city: 'Barranquilla',
      phone: '3001112233',
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://mu-integraciones.mensajerosurbanos.com/api/Add-store');
    const body = JSON.parse(options.body);
    expect(body.id_point).toBe('kpu-baq-01');
    expect(body.name).toBe('KPU Cafe Barranquilla');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- lib/__tests__/mensajeros-urbanos.test.ts
```

Expected: FAIL — module `../mensajeros-urbanos` does not export the expected functions.

- [ ] **Step 3: Implement MU client**

Create `lib/mensajeros-urbanos.ts`:

```typescript
const MU_BASE_URL = 'https://mu-integraciones.mensajerosurbanos.com';

export const MU_CITY_IDS: Record<string, number> = {
  Barranquilla: 4,
  Bogota: 1,
  Cali: 2,
  Medellin: 3,
  Cartagena: 8,
};

// --- Types ---

export interface MuCalculateParams {
  accessToken: string;
  cityId: number;
  declaredValue: number;
  originAddress: string;
  destinationAddress: string;
}

export interface MuCalculateResult {
  totalService: number;
  totalDistance: string;
  baseValue: number;
  distanceSurcharge: number;
  insuranceSurcharge: number;
}

export interface MuDestination {
  address: string;
  orderId: string;
  description: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  paymentType: '1' | '2' | '3';
  productsValue: number;
  domicileValue: string;
}

export interface MuProduct {
  storeId: string;
  productName: string;
  quantity: number;
  value: number;
  sku?: string;
}

export interface MuCreateParams {
  accessToken: string;
  cityId: number;
  declaredValue: number;
  startDate: string; // YYYY-mm-dd
  startTime: string; // HH:MM:ss
  storeId: string;
  destination: MuDestination;
  products: MuProduct[];
  observation?: string;
}

export interface MuCreateResult {
  taskId: number;
  uuid: string;
  status: number;
  total: number;
  distance: string;
}

export interface MuTrackParams {
  accessToken: string;
  uuid: string;
}

export interface MuDriver {
  name: string;
  phone: string;
  plate: string;
  vehicleType: string;
  photo: string;
}

export interface MuTrackResult {
  taskId: number;
  statusId: number;
  statusName: string;
  driver: MuDriver | null;
  addresses: Array<{ address: string; status: number }>;
  history: Array<{ statusId: number; status: string; date: string }>;
}

export interface MuCancelParams {
  accessToken: string;
  uuid: string;
  cancellationType: 1 | 2 | 3 | 4;
  description: string;
}

export interface MuAddStoreParams {
  accessToken: string;
  idPoint: string;
  name: string;
  address: string;
  city: string;
  phone?: string;
}

export interface MuRegisterWebhookParams {
  accessToken: string;
  endpoint: string;
  tokenEndpoint: string;
}

// --- Helpers ---

class MuApiError extends Error {
  constructor(public status: number, message: string) {
    super(`MU API error (${status}): ${message}`);
    this.name = 'MuApiError';
  }
}

async function muPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${MU_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new MuApiError(res.status, data.message || JSON.stringify(data));
  }
  return data as T;
}

// --- API Functions ---

export async function muCalculate(params: MuCalculateParams): Promise<MuCalculateResult> {
  const data = await muPost<any>('/api/calculate', {
    access_token: params.accessToken,
    type_service: 4,
    roundtrip: 0,
    declared_value: params.declaredValue,
    city: params.cityId,
    parking_surcharge: 0,
    coordinates: [
      { type: '1', address: params.originAddress },
      { type: '1', address: params.destinationAddress },
    ],
  });

  return {
    totalService: data.total_service,
    totalDistance: data.total_distance,
    baseValue: data.base_value,
    distanceSurcharge: data.distance_surcharge,
    insuranceSurcharge: data.insurance_surcharge,
  };
}

export async function muCreateService(params: MuCreateParams): Promise<MuCreateResult> {
  const data = await muPost<any>('/api/create', {
    access_token: params.accessToken,
    type_service: 4,
    roundtrip: 0,
    declared_value: params.declaredValue,
    city: params.cityId,
    start_date: params.startDate,
    start_time: params.startTime,
    os: 'NEW API 2.0',
    coordinates: [
      {
        type: '1',
        address: params.destination.address,
        order_id: params.destination.orderId,
        description: params.destination.description,
        client_data: {
          client_name: params.destination.clientName,
          client_phone: params.destination.clientPhone,
          client_email: params.destination.clientEmail || '',
          payment_type: params.destination.paymentType,
          products_value: params.destination.productsValue,
          domicile_value: params.destination.domicileValue,
        },
        products: params.products.map((p) => ({
          store_id: p.storeId,
          product_name: p.productName,
          quantity: p.quantity,
          value: p.value,
          sku: p.sku || '',
        })),
      },
    ],
    observation: params.observation || '',
  });

  return {
    taskId: data.task_id,
    uuid: data.uuid,
    status: data.status,
    total: data.total,
    distance: data.distance,
  };
}

export async function muTrack(params: MuTrackParams): Promise<MuTrackResult> {
  const data = await muPost<any>('/api/track', {
    access_token: params.accessToken,
    uuid: params.uuid,
  });

  const resource = data.resource;
  return {
    taskId: data.data?.task_id,
    statusId: data.data?.status_id,
    statusName: data.data?.status,
    driver: resource
      ? {
          name: resource.name,
          phone: resource.phone,
          plate: resource.plate_number,
          vehicleType: resource.type_resource_name,
          photo: resource.photo,
        }
      : null,
    addresses: (data.address || []).map((a: any) => ({
      address: a.address,
      status: a.status,
    })),
    history: (data.history || []).map((h: any) => ({
      statusId: h.status_id,
      status: h.status,
      date: h.date,
    })),
  };
}

export async function muCancel(params: MuCancelParams): Promise<void> {
  await muPost('/api/cancel', {
    acces_token: params.accessToken, // Note: MU API has typo "acces_token"
    task_uuid: params.uuid,
    cancellation_type: params.cancellationType,
    description: params.description,
  });
}

export async function muAddStore(params: MuAddStoreParams): Promise<void> {
  await muPost('/api/Add-store', {
    access_token: params.accessToken,
    id_point: params.idPoint,
    name: params.name,
    address: params.address,
    city: params.city,
    phone: params.phone || '',
  });
}

export async function muRegisterWebhook(params: MuRegisterWebhookParams): Promise<void> {
  await muPost('/api/webhook', {
    access_token: params.accessToken,
    endpoint: params.endpoint,
    token_endpoint: params.tokenEndpoint,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- lib/__tests__/mensajeros-urbanos.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/mensajeros-urbanos.ts lib/__tests__/mensajeros-urbanos.test.ts
git commit -m "feat: add Mensajeros Urbanos API client library"
```

---

## Task 3: Email Service with Resend

**Files:**
- Create: `lib/email.ts`

- [ ] **Step 1: Install Resend**

```bash
npm install resend
```

- [ ] **Step 2: Create email service**

Create `lib/email.ts`:

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'KPU Cafe <noreply@kpucafe.com>';

interface OrderEmailData {
  to: string;
  orderId: string;
  customerName: string;
}

interface DriverEmailData extends OrderEmailData {
  driverName: string;
  driverPhone: string;
  driverPlate: string;
  trackingUrl?: string;
  eta?: string;
}

function orderHeader(orderId: string): string {
  return `
    <div style="background-color:#2D1810;padding:24px;text-align:center;">
      <h1 style="color:#D4A574;font-family:sans-serif;margin:0;">KPU Cafe</h1>
    </div>
    <div style="padding:24px;">
      <p style="color:#666;font-size:14px;margin:0 0 4px;">Pedido #${orderId.slice(0, 8).toUpperCase()}</p>
  `;
}

function emailFooter(): string {
  return `
    </div>
    <div style="background-color:#f5f5f5;padding:16px;text-align:center;">
      <p style="color:#999;font-size:12px;margin:0;">KPU Cafe - Cafe de especialidad colombiano</p>
      <p style="color:#999;font-size:12px;margin:4px 0 0;"><a href="https://kpucafe.com" style="color:#2D1810;">kpucafe.com</a></p>
    </div>
  `;
}

function wrap(content: string): string {
  return `<div style="max-width:600px;margin:0 auto;font-family:sans-serif;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee;">${content}</div>`;
}

export async function sendOrderPreparingEmail(data: OrderEmailData & { scheduledDate?: string }) {
  const scheduleNote = data.scheduledDate
    ? `<p style="color:#333;"><strong>Envio programado para:</strong> ${data.scheduledDate}</p>`
    : '';

  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${data.orderId.slice(0, 8).toUpperCase()} esta en preparacion`,
    html: wrap(`
      ${orderHeader(data.orderId)}
      <h2 style="color:#2D1810;margin:0 0 16px;">Hola ${data.customerName},</h2>
      <p style="color:#333;">Tu pago fue confirmado y estamos coordinando el envio de tu pedido con Mensajeros Urbanos.</p>
      ${scheduleNote}
      <p style="color:#333;">Te notificaremos cuando un mensajero sea asignado.</p>
      <a href="https://kpucafe.com/pedido/${data.orderId}" style="display:inline-block;background:#2D1810;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;">Ver mi pedido</a>
      ${emailFooter()}
    `),
  });
}

export async function sendDriverAssignedEmail(data: DriverEmailData) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Un mensajero recogera tu pedido #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: wrap(`
      ${orderHeader(data.orderId)}
      <h2 style="color:#2D1810;margin:0 0 16px;">Hola ${data.customerName},</h2>
      <p style="color:#333;">Un mensajero ha sido asignado para recoger tu pedido:</p>
      <div style="background:#f9f5f0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;"><strong>Mensajero:</strong> ${data.driverName}</p>
        <p style="margin:0 0 8px;"><strong>Telefono:</strong> <a href="tel:${data.driverPhone}" style="color:#2D1810;">${data.driverPhone}</a></p>
        <p style="margin:0;"><strong>Placa:</strong> ${data.driverPlate}</p>
        ${data.eta ? `<p style="margin:8px 0 0;"><strong>ETA:</strong> ${data.eta}</p>` : ''}
      </div>
      ${data.trackingUrl ? `<a href="${data.trackingUrl}" style="display:inline-block;background:#2D1810;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;">Ver en mapa</a>` : ''}
      ${emailFooter()}
    `),
  });
}

export async function sendOrderPickingUpEmail(data: OrderEmailData) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${data.orderId.slice(0, 8).toUpperCase()} esta siendo recogido`,
    html: wrap(`
      ${orderHeader(data.orderId)}
      <h2 style="color:#2D1810;margin:0 0 16px;">Hola ${data.customerName},</h2>
      <p style="color:#333;">El mensajero llego a nuestra tienda y esta recogiendo tu pedido. Pronto estara en camino.</p>
      <a href="https://kpucafe.com/pedido/${data.orderId}" style="display:inline-block;background:#2D1810;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;">Ver mi pedido</a>
      ${emailFooter()}
    `),
  });
}

export async function sendOrderOnTheWayEmail(data: DriverEmailData) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${data.orderId.slice(0, 8).toUpperCase()} va en camino`,
    html: wrap(`
      ${orderHeader(data.orderId)}
      <h2 style="color:#2D1810;margin:0 0 16px;">Hola ${data.customerName},</h2>
      <p style="color:#333;">Tu pedido va en camino!</p>
      <div style="background:#f9f5f0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;"><strong>Mensajero:</strong> ${data.driverName}</p>
        <p style="margin:0;"><strong>Telefono:</strong> <a href="tel:${data.driverPhone}" style="color:#2D1810;">${data.driverPhone}</a></p>
      </div>
      ${data.trackingUrl ? `<a href="${data.trackingUrl}" style="display:inline-block;background:#2D1810;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;">Ver en mapa</a>` : ''}
      ${emailFooter()}
    `),
  });
}

export async function sendOrderDeliveredEmail(data: OrderEmailData) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${data.orderId.slice(0, 8).toUpperCase()} fue entregado`,
    html: wrap(`
      ${orderHeader(data.orderId)}
      <h2 style="color:#2D1810;margin:0 0 16px;">Hola ${data.customerName},</h2>
      <p style="color:#333;">Tu pedido fue entregado exitosamente. Esperamos que disfrutes tu cafe!</p>
      <a href="https://kpucafe.com" style="display:inline-block;background:#2D1810;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;">Volver a la tienda</a>
      ${emailFooter()}
    `),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts package.json package-lock.json
git commit -m "feat: add transactional email service with Resend"
```

---

## Task 4: Delivery Settings Admin API

**Files:**
- Create: `app/api/admin/delivery-settings/route.ts`
- Create: `app/api/admin/delivery-settings/register-store/route.ts`

- [ ] **Step 1: Create delivery settings CRUD route**

Create `app/api/admin/delivery-settings/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { log } from '@/lib/logger';

export async function GET() {
  try {
    await requireAdmin();
    const settings = await prisma.deliverySettings.findMany();
    return NextResponse.json(settings);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAdmin();
    const data = await req.json();

    const settings = await prisma.deliverySettings.upsert({
      where: { city: data.city },
      update: {
        enabled: data.enabled,
        muAccessToken: data.muAccessToken,
        muWebhookToken: data.muWebhookToken,
        pickupAddress: data.pickupAddress,
        pickupCity: data.pickupCity,
        pickupStoreId: data.pickupStoreId,
        pickupStoreName: data.pickupStoreName,
        pickupPhone: data.pickupPhone,
        timeSlots: data.timeSlots,
        availableDays: data.availableDays,
      },
      create: {
        city: data.city,
        enabled: data.enabled ?? true,
        muAccessToken: data.muAccessToken,
        muWebhookToken: data.muWebhookToken,
        pickupAddress: data.pickupAddress,
        pickupCity: data.pickupCity,
        pickupStoreId: data.pickupStoreId,
        pickupStoreName: data.pickupStoreName,
        pickupPhone: data.pickupPhone,
        timeSlots: data.timeSlots ?? [],
        availableDays: data.availableDays ?? 7,
      },
    });

    log({ level: 'info', type: 'admin', action: 'update_delivery_settings', message: `Delivery settings updated for ${data.city}`, userId: session.id });
    return NextResponse.json(settings);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create register-store route**

Create `app/api/admin/delivery-settings/register-store/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { muAddStore } from '@/lib/mensajeros-urbanos';
import { log } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const { city } = await req.json();

    const settings = await prisma.deliverySettings.findUnique({ where: { city } });
    if (!settings) return NextResponse.json({ message: 'Configuracion no encontrada para esta ciudad' }, { status: 404 });

    await muAddStore({
      accessToken: settings.muAccessToken,
      idPoint: settings.pickupStoreId,
      name: settings.pickupStoreName,
      address: settings.pickupAddress,
      city: settings.pickupCity,
      phone: settings.pickupPhone,
    });

    log({ level: 'info', type: 'delivery', action: 'register_mu_store', message: `MU store registered for ${city}`, userId: session.id });
    return NextResponse.json({ message: 'Punto de recogida registrado en Mensajeros Urbanos' });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/delivery-settings/
git commit -m "feat: add admin delivery settings API routes"
```

---

## Task 5: Delivery Quote API

**Files:**
- Create: `app/api/delivery/quote/route.ts`

- [ ] **Step 1: Create public delivery quote route**

Create `app/api/delivery/quote/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { muCalculate, MU_CITY_IDS } from '@/lib/mensajeros-urbanos';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city');
    const address = searchParams.get('address');

    if (!city || !address) {
      return NextResponse.json({ message: 'city y address son requeridos' }, { status: 400 });
    }

    const cityId = MU_CITY_IDS[city];
    if (!cityId) {
      return NextResponse.json({ available: false, reason: 'Ciudad no disponible para delivery express' });
    }

    const settings = await prisma.deliverySettings.findUnique({ where: { city } });
    if (!settings || !settings.enabled) {
      return NextResponse.json({ available: false, reason: 'Delivery express no disponible en esta ciudad' });
    }

    const quote = await muCalculate({
      accessToken: settings.muAccessToken,
      cityId,
      declaredValue: 0, // Will be recalculated with actual order total at creation time
      originAddress: settings.pickupAddress,
      destinationAddress: address,
    });

    return NextResponse.json({
      available: true,
      shippingCost: quote.totalService,
      distance: quote.totalDistance,
      timeSlots: settings.timeSlots,
      availableDays: settings.availableDays,
    });
  } catch (err: any) {
    // If MU API fails, fallback to unavailable
    return NextResponse.json({ available: false, reason: 'No se pudo cotizar el envio express' });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/delivery/quote/route.ts
git commit -m "feat: add delivery quote API route"
```

---

## Task 6: MU Webhook Receiver

**Files:**
- Create: `app/api/delivery/mu-webhook/route.ts`

- [ ] **Step 1: Create webhook receiver**

Create `app/api/delivery/mu-webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';
import {
  sendDriverAssignedEmail,
  sendOrderPickingUpEmail,
  sendOrderOnTheWayEmail,
  sendOrderDeliveredEmail,
} from '@/lib/email';

export async function POST(req: Request) {
  try {
    const webhookToken = req.headers.get('x-api-key');

    // Validate webhook token against any delivery_settings entry
    const settings = await prisma.deliverySettings.findFirst({
      where: { muWebhookToken: webhookToken || '' },
    });
    if (!settings) {
      return NextResponse.json({ message: 'Invalid webhook token' }, { status: 401 });
    }

    const payload = await req.json();
    const { uuid, status_id, status, num_place, mensajero, phone, vehicle_plate, photo_url, ETA, order_id, url, finish_status } = payload;

    log({
      level: 'info',
      type: 'delivery',
      action: 'mu_webhook_received',
      message: `MU webhook: uuid=${uuid} status=${status} (${status_id}) num_place=${num_place}`,
      metadata: payload,
    });

    // Find order by MU UUID
    const order = await prisma.order.findFirst({ where: { muUuid: uuid } });
    if (!order) {
      log({ level: 'warn', type: 'delivery', action: 'mu_webhook_order_not_found', message: `No order found for MU uuid=${uuid}` });
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // Get customer email for notifications
    const user = order.userId
      ? await prisma.user.findUnique({ where: { id: order.userId } })
      : null;
    const customerEmail = user?.email;
    const customerName = order.shippingName;

    const baseEmailData = customerEmail
      ? { to: customerEmail, orderId: order.id, customerName }
      : null;

    // Process based on MU status
    switch (status_id) {
      case 2: // on_hold - waiting for driver
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'on_hold' },
        });
        break;

      case 3: // assigned - driver accepted
        await prisma.order.update({
          where: { id: order.id },
          data: {
            muStatus: 'assigned',
            muDriverName: mensajero || null,
            muDriverPhone: phone || null,
            muDriverPlate: vehicle_plate || null,
            muTrackingUrl: url || null,
            muEta: ETA || null,
          },
        });
        if (baseEmailData) {
          sendDriverAssignedEmail({
            ...baseEmailData,
            driverName: mensajero || 'Mensajero',
            driverPhone: phone || '',
            driverPlate: vehicle_plate || '',
            trackingUrl: url,
            eta: ETA,
          }).catch(() => {});
        }
        break;

      case 4: // in_progress
        if (num_place === 1) {
          // Driver at store picking up
          await prisma.order.update({
            where: { id: order.id },
            data: { muStatus: 'picking_up' },
          });
          if (baseEmailData) {
            sendOrderPickingUpEmail(baseEmailData).catch(() => {});
          }
        } else if (num_place === 2) {
          // Driver heading to customer
          await prisma.order.update({
            where: { id: order.id },
            data: { muStatus: 'delivering', status: 'shipped' },
          });
          if (baseEmailData) {
            sendOrderOnTheWayEmail({
              ...baseEmailData,
              driverName: order.muDriverName || mensajero || 'Mensajero',
              driverPhone: order.muDriverPhone || phone || '',
              driverPlate: order.muDriverPlate || vehicle_plate || '',
              trackingUrl: order.muTrackingUrl || url,
            }).catch(() => {});
          }
        }
        break;

      case 5: // finished
        if (finish_status === 1) {
          await prisma.order.update({
            where: { id: order.id },
            data: { muStatus: 'finished', status: 'delivered' },
          });
          if (baseEmailData) {
            sendOrderDeliveredEmail(baseEmailData).catch(() => {});
          }
        } else {
          await prisma.order.update({
            where: { id: order.id },
            data: { muStatus: 'failed_delivery' },
          });
          log({ level: 'warn', type: 'delivery', action: 'mu_delivery_failed', message: `Delivery failed for order ${order.id}`, metadata: payload });
        }
        break;

      case 6: // cancel
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'cancelled' },
        });
        log({ level: 'warn', type: 'delivery', action: 'mu_service_cancelled', message: `MU service cancelled for order ${order.id}`, metadata: payload });
        break;
    }

    return NextResponse.json({ message: 'OK' });
  } catch (err: any) {
    log({ level: 'error', type: 'delivery', action: 'mu_webhook_error', message: err.message, error: err.stack });
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/delivery/mu-webhook/route.ts
git commit -m "feat: add MU webhook receiver with status mapping and emails"
```

---

## Task 7: Admin Retry/Cancel MU Routes

**Files:**
- Create: `app/api/admin/orders/[id]/retry-mu/route.ts`
- Create: `app/api/admin/orders/[id]/cancel-mu/route.ts`

- [ ] **Step 1: Create retry-mu route**

Create `app/api/admin/orders/[id]/retry-mu/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { muCreateService, MU_CITY_IDS } from '@/lib/mensajeros-urbanos';
import { log } from '@/lib/logger';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) return NextResponse.json({ message: 'Pedido no encontrado' }, { status: 404 });
    if (order.deliveryMethod !== 'mensajeros_urbanos') {
      return NextResponse.json({ message: 'Este pedido no usa Mensajeros Urbanos' }, { status: 400 });
    }

    const cityId = MU_CITY_IDS[order.shippingCity];
    if (!cityId) return NextResponse.json({ message: 'Ciudad no soportada por MU' }, { status: 400 });

    const settings = await prisma.deliverySettings.findUnique({ where: { city: order.shippingCity } });
    if (!settings || !settings.enabled) {
      return NextResponse.json({ message: 'Delivery no habilitado para esta ciudad' }, { status: 400 });
    }

    const now = new Date();
    const startDate = order.scheduledDate || now;
    const dateStr = startDate.toISOString().split('T')[0];
    const timeStr = startDate.toTimeString().split(' ')[0];

    const result = await muCreateService({
      accessToken: settings.muAccessToken,
      cityId,
      declaredValue: order.total,
      startDate: dateStr,
      startTime: timeStr,
      storeId: settings.pickupStoreId,
      destination: {
        address: order.shippingAddress,
        orderId: order.id.slice(0, 20),
        description: order.notes || '',
        clientName: order.shippingName,
        clientPhone: order.shippingPhone,
        paymentType: '3',
        productsValue: order.total,
        domicileValue: String(order.shippingCost || 0),
      },
      products: order.items.map((item) => ({
        storeId: settings.pickupStoreId,
        productName: item.productName,
        quantity: item.quantity,
        value: item.unitPrice,
      })),
      observation: `KPU Cafe - Pedido #${order.id.slice(0, 8)}`,
    });

    await prisma.order.update({
      where: { id },
      data: {
        muUuid: result.uuid,
        muTaskId: result.taskId,
        muStatus: result.status === 1 ? 'create' : 'on_hold',
        status: 'preparing',
      },
    });

    log({ level: 'info', type: 'delivery', action: 'mu_retry_success', message: `MU service retried for order ${id}`, userId: session.id, metadata: { muUuid: result.uuid } });
    return NextResponse.json({ message: 'Servicio MU creado exitosamente', uuid: result.uuid });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create cancel-mu route**

Create `app/api/admin/orders/[id]/cancel-mu/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { muCancel } from '@/lib/mensajeros-urbanos';
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
    if (!order.muUuid) return NextResponse.json({ message: 'Este pedido no tiene servicio MU activo' }, { status: 400 });

    const settings = await prisma.deliverySettings.findUnique({ where: { city: order.shippingCity } });
    if (!settings) return NextResponse.json({ message: 'Configuracion no encontrada' }, { status: 400 });

    await muCancel({
      accessToken: settings.muAccessToken,
      uuid: order.muUuid,
      cancellationType: 3,
      description: 'Cancelado por admin KPU Cafe',
    });

    await prisma.order.update({
      where: { id },
      data: { muStatus: 'cancelled' },
    });

    log({ level: 'info', type: 'delivery', action: 'mu_cancel', message: `MU service cancelled for order ${id}`, userId: session.id });
    return NextResponse.json({ message: 'Servicio MU cancelado' });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/orders/[id]/retry-mu/ app/api/admin/orders/[id]/cancel-mu/
git commit -m "feat: add admin retry and cancel MU API routes"
```

---

## Task 8: Modify Order Creation to Support MU Fields

**Files:**
- Modify: `app/api/orders/route.ts`

- [ ] **Step 1: Add MU fields to order creation**

In `app/api/orders/route.ts`, update the `POST` handler's `tx.order.create` data block to include the new delivery fields. Replace the `data` object inside `tx.order.create` (lines 29-41):

```typescript
        data: {
          userId: session.id,
          total: data.total,
          couponId: data.couponId,
          discountAmount: data.discountAmount ?? 0,
          shippingName: data.shippingName,
          shippingPhone: data.shippingPhone,
          shippingAddress: data.shippingAddress,
          shippingCity: data.shippingCity,
          shippingDepartment: data.shippingDepartment,
          shippingPostalCode: data.shippingPostalCode,
          notes: data.notes,
          deliveryMethod: data.deliveryMethod || 'standard',
          shippingCost: data.shippingCost ?? null,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
        },
```

- [ ] **Step 2: Commit**

```bash
git add app/api/orders/route.ts
git commit -m "feat: support deliveryMethod, shippingCost, scheduledDate in order creation"
```

---

## Task 9: Trigger MU Service After Payment

**Files:**
- Create: `lib/delivery.ts`
- Modify: `app/api/payment-methods/[id]/charge/route.ts`
- Modify: `app/api/payment-methods/charge-once/route.ts`

- [ ] **Step 1: Create delivery trigger helper**

Create `lib/delivery.ts` — a function that checks if an order needs MU delivery and creates the service:

```typescript
import { prisma } from '@/lib/prisma';
import { muCreateService, MU_CITY_IDS } from '@/lib/mensajeros-urbanos';
import { sendOrderPreparingEmail } from '@/lib/email';
import { log } from '@/lib/logger';

export async function triggerMuDeliveryIfNeeded(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: true },
  });

  if (!order || order.deliveryMethod !== 'mensajeros_urbanos') return;

  const cityId = MU_CITY_IDS[order.shippingCity];
  if (!cityId) {
    await prisma.order.update({ where: { id: orderId }, data: { muStatus: 'error' } });
    log({ level: 'error', type: 'delivery', action: 'mu_city_not_supported', message: `City not supported: ${order.shippingCity}`, metadata: { orderId } });
    return;
  }

  const settings = await prisma.deliverySettings.findUnique({ where: { city: order.shippingCity } });
  if (!settings || !settings.enabled) {
    await prisma.order.update({ where: { id: orderId }, data: { muStatus: 'error' } });
    log({ level: 'error', type: 'delivery', action: 'mu_not_enabled', message: `MU not enabled for ${order.shippingCity}`, metadata: { orderId } });
    return;
  }

  try {
    const now = new Date();
    const startDate = order.scheduledDate || now;
    const dateStr = startDate.toISOString().split('T')[0];
    const timeStr = startDate.toTimeString().split(' ')[0];

    const result = await muCreateService({
      accessToken: settings.muAccessToken,
      cityId,
      declaredValue: order.total,
      startDate: dateStr,
      startTime: timeStr,
      storeId: settings.pickupStoreId,
      destination: {
        address: order.shippingAddress,
        orderId: order.id.slice(0, 20),
        description: order.notes || '',
        clientName: order.shippingName,
        clientPhone: order.shippingPhone,
        clientEmail: order.user?.email,
        paymentType: '3',
        productsValue: order.total,
        domicileValue: String(order.shippingCost || 0),
      },
      products: order.items.map((item) => ({
        storeId: settings.pickupStoreId,
        productName: item.productName,
        quantity: item.quantity,
        value: item.unitPrice,
      })),
      observation: `KPU Cafe - Pedido #${order.id.slice(0, 8)}`,
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        muUuid: result.uuid,
        muTaskId: result.taskId,
        muStatus: result.status === 1 ? 'create' : 'on_hold',
        status: 'preparing',
      },
    });

    log({ level: 'info', type: 'delivery', action: 'mu_service_created', message: `MU service created for order ${orderId}`, metadata: { muUuid: result.uuid, muTaskId: result.taskId } });

    // Send preparing email
    if (order.user?.email) {
      const scheduledLabel = order.scheduledDate
        ? new Date(order.scheduledDate).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
        : undefined;
      sendOrderPreparingEmail({
        to: order.user.email,
        orderId: order.id,
        customerName: order.shippingName,
        scheduledDate: scheduledLabel,
      }).catch(() => {});
    }
  } catch (err: any) {
    await prisma.order.update({ where: { id: orderId }, data: { muStatus: 'error' } });
    log({ level: 'error', type: 'delivery', action: 'mu_create_failed', message: `Failed to create MU service for order ${orderId}`, error: err.message });
  }
}
```

- [ ] **Step 2: Add trigger to charge-once route**

In `app/api/payment-methods/charge-once/route.ts`, add import at the top:

```typescript
import { triggerMuDeliveryIfNeeded } from '@/lib/delivery';
```

After the `status === 'approved'` block (after line 58, the closing `}`), add:

```typescript
      // Trigger MU delivery for Barranquilla orders
      triggerMuDeliveryIfNeeded(orderId).catch(() => {});
```

- [ ] **Step 3: Add trigger to saved card charge route**

In `app/api/payment-methods/[id]/charge/route.ts`, add import at the top:

```typescript
import { triggerMuDeliveryIfNeeded } from '@/lib/delivery';
```

After the `result.status === 'approved'` block (after line 92), add:

```typescript
      // Trigger MU delivery for Barranquilla orders
      if (targetOrderId) triggerMuDeliveryIfNeeded(targetOrderId).catch(() => {});
```

- [ ] **Step 4: Commit**

```bash
git add lib/delivery.ts app/api/payment-methods/charge-once/route.ts app/api/payment-methods/[id]/charge/route.ts
git commit -m "feat: trigger MU delivery service after payment approval"
```

---

## Task 10: Admin Delivery Configuration Page

**Files:**
- Create: `app/admin/configuracion/delivery/page.tsx`

- [ ] **Step 1: Create the admin config page**

Create `app/admin/configuracion/delivery/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Save, Loader2, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TimeSlot {
  label: string;
  start: string;
  end: string;
}

interface DeliveryConfig {
  city: string;
  enabled: boolean;
  muAccessToken: string;
  muWebhookToken: string;
  pickupAddress: string;
  pickupCity: string;
  pickupStoreId: string;
  pickupStoreName: string;
  pickupPhone: string;
  timeSlots: TimeSlot[];
  availableDays: number;
}

const DEFAULT_CONFIG: DeliveryConfig = {
  city: 'Barranquilla',
  enabled: true,
  muAccessToken: '',
  muWebhookToken: '',
  pickupAddress: '',
  pickupCity: 'Barranquilla',
  pickupStoreId: '',
  pickupStoreName: '',
  pickupPhone: '',
  timeSlots: [
    { label: '9:00 - 12:00', start: '09:00:00', end: '12:00:00' },
    { label: '12:00 - 15:00', start: '12:00:00', end: '15:00:00' },
    { label: '15:00 - 18:00', start: '15:00:00', end: '18:00:00' },
  ],
  availableDays: 7,
};

export default function DeliveryConfigPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<DeliveryConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/delivery-settings');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const s = data[0];
        setConfig({
          city: s.city,
          enabled: s.enabled,
          muAccessToken: s.muAccessToken,
          muWebhookToken: s.muWebhookToken,
          pickupAddress: s.pickupAddress,
          pickupCity: s.pickupCity,
          pickupStoreId: s.pickupStoreId,
          pickupStoreName: s.pickupStoreName,
          pickupPhone: s.pickupPhone,
          timeSlots: s.timeSlots as TimeSlot[],
          availableDays: s.availableDays,
        });
      }
    } catch {
      // Use defaults
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/delivery-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Configuracion guardada' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleRegisterStore = async () => {
    setRegistering(true);
    try {
      const res = await fetch('/api/admin/delivery-settings/register-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: config.city }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Punto registrado en Mensajeros Urbanos' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setRegistering(false);
  };

  const addTimeSlot = () => {
    setConfig((c) => ({
      ...c,
      timeSlots: [...c.timeSlots, { label: '', start: '', end: '' }],
    }));
  };

  const removeTimeSlot = (index: number) => {
    setConfig((c) => ({
      ...c,
      timeSlots: c.timeSlots.filter((_, i) => i !== index),
    }));
  };

  const updateTimeSlot = (index: number, field: keyof TimeSlot, value: string) => {
    setConfig((c) => ({
      ...c,
      timeSlots: c.timeSlots.map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      ),
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Configuracion de Delivery - Mensajeros Urbanos
        </h2>
        <button
          onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${config.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
        >
          {config.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
          {config.enabled ? 'Activo' : 'Desactivado'}
        </button>
      </div>

      {/* Credentials */}
      <section className="bg-card rounded-xl p-6 shadow-soft space-y-4">
        <h3 className="font-semibold text-foreground">Credenciales MU</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Access Token</label>
            <input type="password" className={inputClass} value={config.muAccessToken}
              onChange={(e) => setConfig((c) => ({ ...c, muAccessToken: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Webhook Token</label>
            <input type="password" className={inputClass} value={config.muWebhookToken}
              onChange={(e) => setConfig((c) => ({ ...c, muWebhookToken: e.target.value }))} />
          </div>
        </div>
      </section>

      {/* Pickup Point */}
      <section className="bg-card rounded-xl p-6 shadow-soft space-y-4">
        <h3 className="font-semibold text-foreground">Punto de Recogida</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Nombre del punto</label>
            <input className={inputClass} value={config.pickupStoreName}
              onChange={(e) => setConfig((c) => ({ ...c, pickupStoreName: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">ID del punto (max 20 chars)</label>
            <input className={inputClass} maxLength={20} value={config.pickupStoreId}
              onChange={(e) => setConfig((c) => ({ ...c, pickupStoreId: e.target.value.replace(/[^a-zA-Z0-9-]/g, '') }))} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-muted-foreground mb-1 block">Direccion de recogida</label>
            <input className={inputClass} value={config.pickupAddress}
              onChange={(e) => setConfig((c) => ({ ...c, pickupAddress: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Ciudad</label>
            <input className={inputClass} value={config.pickupCity}
              onChange={(e) => setConfig((c) => ({ ...c, pickupCity: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Telefono</label>
            <input className={inputClass} value={config.pickupPhone}
              onChange={(e) => setConfig((c) => ({ ...c, pickupPhone: e.target.value }))} />
          </div>
        </div>
        <button onClick={handleRegisterStore} disabled={registering}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
          {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Registrar punto en MU
        </button>
      </section>

      {/* Time Slots */}
      <section className="bg-card rounded-xl p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Franjas Horarias</h3>
          <button onClick={addTimeSlot} className="flex items-center gap-1 text-sm text-primary hover:underline">
            <Plus className="h-4 w-4" />Agregar franja
          </button>
        </div>
        <div className="space-y-3">
          {config.timeSlots.map((slot, i) => (
            <div key={i} className="flex items-center gap-3">
              <input className={inputClass} placeholder="Etiqueta (ej: 9:00 - 12:00)" value={slot.label}
                onChange={(e) => updateTimeSlot(i, 'label', e.target.value)} />
              <input type="time" className={inputClass} value={slot.start.slice(0, 5)}
                onChange={(e) => updateTimeSlot(i, 'start', e.target.value + ':00')} />
              <input type="time" className={inputClass} value={slot.end.slice(0, 5)}
                onChange={(e) => updateTimeSlot(i, 'end', e.target.value + ':00')} />
              <button onClick={() => removeTimeSlot(i)} className="text-destructive hover:text-destructive/80 flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Dias disponibles para programar</label>
          <input type="number" min={1} max={14} className={`${inputClass} w-24`} value={config.availableDays}
            onChange={(e) => setConfig((c) => ({ ...c, availableDays: parseInt(e.target.value) || 7 }))} />
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Guardar configuracion
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

```bash
npm run dev
```

Navigate to `http://localhost:3000/admin/configuracion/delivery` and verify the page loads with the form.

- [ ] **Step 3: Commit**

```bash
git add app/admin/configuracion/delivery/page.tsx
git commit -m "feat: add admin delivery configuration page for MU"
```

---

## Task 11: Checkout MU Detection, Quote, and Scheduling

**Files:**
- Modify: `app/checkout/page.tsx`

- [ ] **Step 1: Add MU state variables and quote fetching**

In `app/checkout/page.tsx`, add these state variables after the existing state declarations (around line 192 area, after the other `useState` calls):

```typescript
  // MU delivery state
  const [muAvailable, setMuAvailable] = useState(false);
  const [muShippingCost, setMuShippingCost] = useState<number | null>(null);
  const [muTimeSlots, setMuTimeSlots] = useState<Array<{ label: string; start: string; end: string }>>([]);
  const [muAvailableDays, setMuAvailableDays] = useState(7);
  const [muQuoteLoading, setMuQuoteLoading] = useState(false);
  const [scheduleDelivery, setScheduleDelivery] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledSlot, setScheduledSlot] = useState('');
```

Add a function to fetch the MU quote (place after the other helper functions, before the `shippingCost` computation):

```typescript
  // Fetch MU delivery quote when city is Barranquilla
  const fetchMuQuote = async (city: string, address: string) => {
    if (city !== 'Barranquilla' || !address) {
      setMuAvailable(false);
      setMuShippingCost(null);
      return;
    }
    setMuQuoteLoading(true);
    try {
      const res = await fetch(`/api/delivery/quote?city=${encodeURIComponent(city)}&address=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (data.available) {
        setMuAvailable(true);
        setMuShippingCost(data.shippingCost);
        setMuTimeSlots(data.timeSlots || []);
        setMuAvailableDays(data.availableDays || 7);
      } else {
        setMuAvailable(false);
        setMuShippingCost(null);
      }
    } catch {
      setMuAvailable(false);
      setMuShippingCost(null);
    }
    setMuQuoteLoading(false);
  };
```

- [ ] **Step 2: Trigger quote on city/address change**

Add a `useEffect` after the `fetchMuQuote` function:

```typescript
  useEffect(() => {
    fetchMuQuote(form.city, form.address);
  }, [form.city, form.address]);
```

Also trigger on saved address selection. Find where saved addresses are loaded/selected and add a call there. When a saved address is selected (`form` is updated), the `useEffect` above will handle it.

- [ ] **Step 3: Update shipping cost calculation**

Replace line 508 (`const shippingCost = totalPrice >= 100000 ? 0 : 12000;`):

```typescript
  const shippingCost = totalPrice >= 100000
    ? 0
    : muAvailable && muShippingCost !== null
      ? muShippingCost
      : 12000;
```

- [ ] **Step 4: Update buildOrderPayload to include MU fields**

Replace the `buildOrderPayload` function (lines 388-405):

```typescript
  const buildOrderPayload = () => {
    let scheduledDateISO: string | null = null;
    if (muAvailable && scheduleDelivery && scheduledDate && scheduledSlot) {
      const slot = muTimeSlots.find((s) => s.label === scheduledSlot);
      if (slot) {
        scheduledDateISO = new Date(`${scheduledDate}T${slot.start}`).toISOString();
      }
    }

    return {
      total: finalTotal,
      shippingName: form.fullName,
      shippingPhone: form.phone,
      shippingAddress: form.address,
      shippingCity: form.city,
      shippingDepartment: form.department,
      shippingPostalCode: form.postalCode || null,
      notes: form.notes || null,
      couponId: appliedCoupon?.id || null,
      discountAmount: discountAmount || 0,
      deliveryMethod: muAvailable ? 'mensajeros_urbanos' : 'standard',
      shippingCost,
      scheduledDate: scheduledDateISO,
      items: items.map((item: any) => ({
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        variantInfo: `${item.weight || ''} - ${item.grind || ''}`.trim().replace(/^-\s*|-\s*$/g, '').trim(),
      })),
    };
  };
```

- [ ] **Step 5: Add scheduling UI in the shipping step**

In the shipping step section (around where the address form fields end), add the MU scheduling block. Find the end of the address form fields (after the `notes` textarea) and add before the closing of the shipping section:

```tsx
              {/* MU Delivery Options */}
              {muAvailable && (
                <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Truck className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-foreground">Envio con Mensajeros Urbanos</span>
                    {muQuoteLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                  {muShippingCost !== null && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Costo de envio: <span className="font-semibold text-foreground">${muShippingCost.toLocaleString('es-CO')}</span>
                    </p>
                  )}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="deliverySchedule" checked={!scheduleDelivery}
                        onChange={() => setScheduleDelivery(false)}
                        className="w-4 h-4 text-primary" />
                      <span className="text-sm text-foreground">Enviar ahora</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="deliverySchedule" checked={scheduleDelivery}
                        onChange={() => setScheduleDelivery(true)}
                        className="w-4 h-4 text-primary" />
                      <span className="text-sm text-foreground">Programar envio</span>
                    </label>
                    {scheduleDelivery && (
                      <div className="ml-7 space-y-3">
                        <div>
                          <label className="text-sm text-muted-foreground mb-1 block">Fecha</label>
                          <input type="date" className={inputClass('')}
                            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                            max={new Date(Date.now() + muAvailableDays * 86400000).toISOString().split('T')[0]}
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground mb-1 block">Franja horaria</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {muTimeSlots.map((slot) => (
                              <button key={slot.label} type="button"
                                onClick={() => setScheduledSlot(slot.label)}
                                className={`px-3 py-2 rounded-lg border text-sm transition-colors ${scheduledSlot === slot.label
                                  ? 'border-primary bg-primary/10 text-primary font-medium'
                                  : 'border-input bg-background text-foreground hover:border-primary/50'
                                }`}>
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
```

- [ ] **Step 6: Show MU badge in review step**

In the review step, find where the shipping cost is displayed and add the MU badge. Look for the shipping cost line in the summary and add above it:

```tsx
                    {muAvailable && (
                      <div className="flex items-center gap-2 py-2">
                        <Truck className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">Envio con Mensajeros Urbanos</span>
                        {scheduleDelivery && scheduledDate && scheduledSlot && (
                          <span className="text-xs text-muted-foreground">
                            - Programado: {new Date(scheduledDate + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', month: 'long', day: 'numeric' })} {scheduledSlot}
                          </span>
                        )}
                      </div>
                    )}
```

- [ ] **Step 7: Verify checkout flow**

```bash
npm run dev
```

1. Add items to cart, go to checkout
2. Enter a Barranquilla address — verify MU quote loads, scheduling options appear
3. Enter a Bogota address — verify standard $12,000 shipping
4. Select "Programar envio" — verify date/slot selectors

- [ ] **Step 8: Commit**

```bash
git add app/checkout/page.tsx
git commit -m "feat: add MU dynamic pricing and scheduling to checkout"
```

---

## Task 12: Order Tracking Page — MU Status and Driver Info

**Files:**
- Modify: `app/pedido/[id]/page.tsx`
- Modify: `app/pedido/[id]/order-status-poller.tsx`

- [ ] **Step 1: Read order-status-poller.tsx for current structure**

Read the current file to understand the STATUS_CONFIG and rendering pattern before modifying.

- [ ] **Step 2: Update OrderStatusPoller to show MU tracking**

In `app/pedido/[id]/order-status-poller.tsx`, update the component to handle MU-specific statuses. The order data returned from `/api/orders/{id}` will now include the new MU fields.

Add MU status display after the existing status section. Extend the `STATUS_CONFIG` map to include MU-specific labels, and add a driver card component:

First, update the `Order` type/interface used in the component to include MU fields:

```typescript
  deliveryMethod?: string;
  muStatus?: string;
  muDriverName?: string;
  muDriverPhone?: string;
  muDriverPlate?: string;
  muTrackingUrl?: string;
  muEta?: string;
  scheduledDate?: string;
```

Add an MU status config map:

```typescript
const MU_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  on_hold: { label: 'Buscando mensajero...', color: 'text-yellow-600' },
  assigned: { label: 'Mensajero asignado', color: 'text-blue-600' },
  picking_up: { label: 'Recogiendo tu pedido', color: 'text-orange-600' },
  delivering: { label: 'En camino', color: 'text-primary' },
  finished: { label: 'Entregado', color: 'text-green-600' },
  failed_delivery: { label: 'Entrega fallida', color: 'text-red-600' },
  cancelled: { label: 'Envio cancelado', color: 'text-red-600' },
  error: { label: 'Error en envio', color: 'text-red-600' },
  create: { label: 'Envio programado', color: 'text-blue-600' },
};
```

Add MU tracking section in the JSX, after the main status display:

```tsx
        {/* MU Delivery Tracking */}
        {order.deliveryMethod === 'mensajeros_urbanos' && order.muStatus && (
          <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">Mensajeros Urbanos</span>
              </div>
              <span className={`text-sm font-medium ${MU_STATUS_CONFIG[order.muStatus]?.color || 'text-muted-foreground'}`}>
                {MU_STATUS_CONFIG[order.muStatus]?.label || order.muStatus}
              </span>
            </div>

            {/* Driver info */}
            {order.muDriverName && (
              <div className="bg-background rounded-lg p-4 space-y-2">
                <p className="text-sm"><span className="text-muted-foreground">Mensajero:</span> <span className="font-medium">{order.muDriverName}</span></p>
                {order.muDriverPhone && (
                  <p className="text-sm"><span className="text-muted-foreground">Telefono:</span> <a href={`tel:${order.muDriverPhone}`} className="font-medium text-primary hover:underline">{order.muDriverPhone}</a></p>
                )}
                {order.muDriverPlate && (
                  <p className="text-sm"><span className="text-muted-foreground">Placa:</span> <span className="font-medium">{order.muDriverPlate}</span></p>
                )}
                {order.muEta && (
                  <p className="text-sm"><span className="text-muted-foreground">ETA:</span> <span className="font-medium">{order.muEta}</span></p>
                )}
              </div>
            )}

            {/* Tracking link */}
            {order.muTrackingUrl && (
              <a href={order.muTrackingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                Ver en mapa
                <ExternalLink className="h-4 w-4" />
              </a>
            )}

            {/* Scheduled date */}
            {order.scheduledDate && ['create', 'on_hold'].includes(order.muStatus) && (
              <p className="text-sm text-muted-foreground">
                Programado para: {new Date(order.scheduledDate).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            )}
          </div>
        )}
```

Add `Truck` and `ExternalLink` to the lucide-react imports in the file.

Also update the polling: change the stop condition so it keeps polling while `muStatus` is not in a terminal state (finished, failed_delivery, cancelled):

For MU orders, the poller should continue polling until the MU delivery reaches a terminal state, not just when the payment status changes. Adjust the polling stop condition to consider both scenarios.

- [ ] **Step 3: Verify tracking page**

```bash
npm run dev
```

Navigate to a test order page. For an order with `deliveryMethod = 'mensajeros_urbanos'`, verify:
- MU status section appears
- Driver card shows when data exists
- Tracking link works

- [ ] **Step 4: Commit**

```bash
git add app/pedido/[id]/page.tsx app/pedido/[id]/order-status-poller.tsx
git commit -m "feat: add MU tracking section to order status page"
```

---

## Task 13: Admin Envios Page — MU Section

**Files:**
- Modify: `app/admin/envios/page.tsx`

- [ ] **Step 1: Add MU fields to Order interface**

In `app/admin/envios/page.tsx`, extend the `Order` interface (lines 7-18):

```typescript
interface Order {
  id: string;
  status: string;
  total: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_department: string | null;
  tracking_number: string | null;
  created_at: string;
  delivery_method: string | null;
  mu_status: string | null;
  mu_driver_name: string | null;
  mu_driver_phone: string | null;
  mu_tracking_url: string | null;
  mu_eta: string | null;
  scheduled_date: string | null;
}
```

- [ ] **Step 2: Update data mapping in fetchPendingShipments**

Update the `.map()` inside `fetchPendingShipments` (lines 33-44) to include new fields:

```typescript
        .map((o: any) => ({
          id: o.id,
          status: o.status,
          total: o.total,
          shipping_name: o.shippingName,
          shipping_phone: o.shippingPhone,
          shipping_address: o.shippingAddress,
          shipping_city: o.shippingCity,
          shipping_department: o.shippingDepartment,
          tracking_number: o.trackingNumber,
          created_at: o.createdAt,
          delivery_method: o.deliveryMethod,
          mu_status: o.muStatus,
          mu_driver_name: o.muDriverName,
          mu_driver_phone: o.muDriverPhone,
          mu_tracking_url: o.muTrackingUrl,
          mu_eta: o.muEta,
          scheduled_date: o.scheduledDate,
        }));
```

- [ ] **Step 3: Add MU action functions**

Add after `markDelivered` function:

```typescript
  const retryMu = async (orderId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/retry-mu`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Servicio MU creado exitosamente' });
      fetchPendingShipments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const cancelMu = async (orderId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/cancel-mu`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Servicio MU cancelado' });
      fetchPendingShipments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };
```

- [ ] **Step 4: Split orders into standard and MU**

Update the filter logic at the bottom (lines 86-87) to separate MU orders:

```typescript
  const standardPreparing = orders.filter(o => (o.status === 'paid' || o.status === 'preparing') && o.delivery_method !== 'mensajeros_urbanos');
  const standardShipped = orders.filter(o => o.status === 'shipped' && o.delivery_method !== 'mensajeros_urbanos');
  const muOrders = orders.filter(o => o.delivery_method === 'mensajeros_urbanos');
```

Rename usages of `preparingOrders` to `standardPreparing` and `shippedOrders` to `standardShipped` in the existing JSX.

- [ ] **Step 5: Add MU section to JSX**

Add a new section after the existing "En Transito" section, before the closing `</div>`:

```tsx
      {/* Mensajeros Urbanos Section */}
      <section>
        <h3 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5 text-blue-500" />Mensajeros Urbanos ({muOrders.length})
        </h3>

        {muOrders.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl">
            <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay envios con Mensajeros Urbanos</p>
          </div>
        ) : (
          <div className="space-y-4">
            {muOrders.map(order => {
              const statusColors: Record<string, string> = {
                on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
                assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                picking_up: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
                delivering: 'bg-primary/10 text-primary',
                finished: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                failed_delivery: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                create: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
              };
              const statusLabels: Record<string, string> = {
                on_hold: 'Buscando mensajero',
                assigned: 'Asignado',
                picking_up: 'Recogiendo',
                delivering: 'En camino',
                finished: 'Entregado',
                failed_delivery: 'Fallido',
                cancelled: 'Cancelado',
                error: 'Error MU',
                create: 'Programado',
              };

              return (
                <div key={order.id} className="bg-card rounded-xl p-6 shadow-soft border-l-4 border-blue-500">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-medium text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[order.mu_status || ''] || 'bg-muted text-muted-foreground'}`}>
                          {statusLabels[order.mu_status || ''] || order.mu_status || 'Pendiente'}
                        </span>
                        {order.scheduled_date && (
                          <span className="text-xs text-muted-foreground">
                            Prog: {new Date(order.scheduled_date).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        )}
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-foreground">{order.shipping_name}</p>
                            <p className="text-sm text-muted-foreground">{order.shipping_phone}</p>
                            <p className="text-sm text-foreground mt-1">{order.shipping_address}</p>
                            <p className="text-sm text-foreground">{order.shipping_city}{order.shipping_department && `, ${order.shipping_department}`}</p>
                          </div>
                        </div>
                        {order.mu_driver_name && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-sm"><span className="text-muted-foreground">Mensajero:</span> {order.mu_driver_name}</p>
                            {order.mu_driver_phone && <p className="text-sm"><span className="text-muted-foreground">Tel:</span> {order.mu_driver_phone}</p>}
                            {order.mu_eta && <p className="text-sm"><span className="text-muted-foreground">ETA:</span> {order.mu_eta}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="font-display text-xl font-bold text-foreground text-right">${order.total.toLocaleString('es-CO')}</p>
                      {order.mu_tracking_url && (
                        <a href={order.mu_tracking_url} target="_blank" rel="noopener noreferrer"
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium text-center">
                          Ver tracking
                        </a>
                      )}
                      {order.mu_status === 'error' && (
                        <button onClick={() => retryMu(order.id)}
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">
                          Reintentar MU
                        </button>
                      )}
                      {(!order.mu_status || order.mu_status === 'on_hold' || order.mu_status === 'create') && (
                        <button onClick={() => cancelMu(order.id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium">
                          Cancelar MU
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
```

Add `ExternalLink` to lucide-react imports if needed.

- [ ] **Step 6: Commit**

```bash
git add app/admin/envios/page.tsx
git commit -m "feat: add Mensajeros Urbanos section to admin envios page"
```

---

## Task 14: Admin Pedidos Page — MU Info in Order Detail

**Files:**
- Modify: `app/admin/pedidos/page.tsx`

- [ ] **Step 1: Read current admin pedidos page structure**

Read the file to understand the expanded order detail rendering.

- [ ] **Step 2: Show MU info in expanded order detail**

In the expanded order detail section, add an MU info block when the order uses MU delivery. Find where order items are displayed in the expanded section and add after:

```tsx
                    {/* MU Delivery Info */}
                    {expandedOrder.deliveryMethod === 'mensajeros_urbanos' && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2">
                          <Truck className="h-4 w-4" />Mensajeros Urbanos
                        </p>
                        <p className="text-sm"><span className="text-muted-foreground">Estado MU:</span> {expandedOrder.muStatus || 'Pendiente'}</p>
                        {expandedOrder.muDriverName && (
                          <p className="text-sm"><span className="text-muted-foreground">Mensajero:</span> {expandedOrder.muDriverName} {expandedOrder.muDriverPhone && `(${expandedOrder.muDriverPhone})`}</p>
                        )}
                        {expandedOrder.muDriverPlate && (
                          <p className="text-sm"><span className="text-muted-foreground">Placa:</span> {expandedOrder.muDriverPlate}</p>
                        )}
                        {expandedOrder.muTrackingUrl && (
                          <a href={expandedOrder.muTrackingUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                            Ver tracking <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {expandedOrder.scheduledDate && (
                          <p className="text-sm"><span className="text-muted-foreground">Programado:</span> {new Date(expandedOrder.scheduledDate).toLocaleString('es-CO')}</p>
                        )}
                      </div>
                    )}
```

Add `Truck` and `ExternalLink` to lucide-react imports.

- [ ] **Step 3: Hide shipping modal for MU orders**

In the `advanceStatus` function, add a check to skip the tracking number modal when the order uses MU delivery. Find the condition that shows the shipping modal (when advancing to `shipped`) and wrap it:

```typescript
    // Skip carrier/tracking modal for MU orders — MU handles this automatically
    if (nextStatus === 'shipped' && order.deliveryMethod === 'mensajeros_urbanos') {
      // Just advance status without requiring tracking number
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'shipped' }),
      });
      if (res.ok) fetchOrders();
      return;
    }
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/pedidos/page.tsx
git commit -m "feat: show MU delivery info in admin order details"
```

---

## Task 15: Add Navigation Link to Admin Delivery Config

**Files:**
- Modify: admin layout or sidebar (find the admin navigation component)

- [ ] **Step 1: Find and update admin navigation**

Locate the admin layout or sidebar component that renders the nav links. Add a new link for the delivery configuration page:

```tsx
{ href: '/admin/configuracion/delivery', label: 'Delivery', icon: Truck }
```

Place it logically near the "Envios" link.

- [ ] **Step 2: Commit**

```bash
git add <admin-nav-file>
git commit -m "feat: add delivery config link to admin navigation"
```

---

## Task 16: Environment Variables and Final Verification

**Files:**
- Modify: `.env.local` (manual)

- [ ] **Step 1: Document required env vars**

Add to `.env.local`:

```
RESEND_API_KEY=re_xxxxxxxxxxxx
```

Note: MU access token and webhook token are stored in `delivery_settings` table, configured via admin panel.

- [ ] **Step 2: Run build to verify no TypeScript errors**

```bash
npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: All tests pass including the new MU client tests.

- [ ] **Step 4: Manual end-to-end verification**

1. Go to `/admin/configuracion/delivery` — configure MU settings
2. Add items to cart → checkout with Barranquilla address → verify quote + scheduling
3. Complete a payment → verify order has `deliveryMethod = 'mensajeros_urbanos'`
4. Check `/admin/envios` — verify MU section shows the order
5. Check order detail page — verify MU tracking section

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Mensajeros Urbanos integration for Barranquilla delivery"
```
