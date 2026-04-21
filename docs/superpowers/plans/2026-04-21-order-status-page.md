# Order Status Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `app/pago-respuesta` with a new `/pedido/[id]` Server Component page that serves as both post-payment confirmation and order detail view, with full invoice download via browser print-to-PDF.

**Architecture:** Server Component fetches order directly from Prisma on initial load (fast, no client round-trip). A thin Client Component (`OrderStatusPoller`) activates only when `status === 'pending'` to poll the new `GET /api/orders/[id]` endpoint every 3s. Invoice is generated client-side as HTML injected into a hidden iframe, then printed via `window.print()`.

**Tech Stack:** Next.js App Router (Server Components, Client Components, Route Handlers), Prisma, TypeScript, Tailwind CSS, Vitest.

---

## File Map

| Action | Path |
|--------|------|
| Create | `app/api/orders/[id]/route.ts` |
| Create | `lib/invoice.ts` |
| Create | `lib/__tests__/invoice.test.ts` |
| Create | `app/pedido/[id]/order-status-poller.tsx` |
| Create | `app/pedido/[id]/page.tsx` |
| Modify | `app/checkout/page.tsx` (lines 424, 459) |
| Modify | `app/mis-pedidos/page.tsx` |
| Delete | `app/pago-respuesta/` |

---

## Task 1: GET /api/orders/[id] Route Handler

**Files:**
- Create: `app/api/orders/[id]/route.ts`
- Test: (inline, verified via curl/browser — no unit test for this Route Handler)

Note: `app/api/orders/[id]/items/route.ts` already exists and must NOT be overwritten. The new file is `app/api/orders/[id]/route.ts` (one level up).

- [ ] **Step 1: Create the Route Handler**

```typescript
// app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: { id, userId: session.id },
      include: {
        items: true,
        coupon: { select: { code: true, discountType: true, discountValue: true } },
      },
    });

    if (!order) return NextResponse.json({ message: 'Pedido no encontrado' }, { status: 404 });

    return NextResponse.json(order);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint -- --max-warnings 0 app/api/orders/\\[id\\]/route.ts`
Expected: no errors (0 warnings, 0 errors)

- [ ] **Step 3: Commit**

```bash
git add app/api/orders/\[id\]/route.ts
git commit -m "feat: add GET /api/orders/[id] route handler"
```

---

## Task 2: lib/invoice.ts + tests

**Files:**
- Create: `lib/invoice.ts`
- Create: `lib/__tests__/invoice.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/__tests__/invoice.test.ts
import { describe, it, expect } from 'vitest';
import { buildInvoiceHtml, type InvoiceOrder } from '@/lib/invoice';

const baseOrder: InvoiceOrder = {
  id: 'abc12345-0000-0000-0000-000000000000',
  status: 'paid',
  total: 52000,
  discountAmount: 5000,
  shippingName: 'Juan Perez',
  shippingPhone: '3001234567',
  shippingAddress: 'Calle 10 # 20-30',
  shippingCity: 'Bogota',
  shippingDepartment: 'Bogota D.C.',
  paymentReference: 'TXN-999',
  createdAt: '2026-04-21T12:00:00.000Z',
  items: [
    { productName: 'Cafe Especial', variantInfo: '250g - Molido', quantity: 2, unitPrice: 45000 },
  ],
  coupon: { code: 'PROMO10', discountType: 'percentage', discountValue: 10 },
};

describe('buildInvoiceHtml', () => {
  it('includes the order number', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('ABC12345');
  });

  it('includes the customer name', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('Juan Perez');
  });

  it('includes the product name', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('Cafe Especial');
  });

  it('includes variant info', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('250g - Molido');
  });

  it('includes the coupon code', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('PROMO10');
  });

  it('includes the payment reference', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('TXN-999');
  });

  it('includes the shipping address', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('Calle 10 # 20-30');
    expect(html).toContain('Bogota D.C.');
  });

  it('renders correctly without coupon', () => {
    const order = { ...baseOrder, coupon: null, discountAmount: 0 };
    const html = buildInvoiceHtml(order);
    expect(html).toContain('Cafe Especial');
    expect(html).not.toContain('PROMO10');
  });

  it('shows "Gratis" for zero shipping cost', () => {
    // total = subtotal (90000) - discount (0) + shipping (0) = 90000
    const order: InvoiceOrder = {
      ...baseOrder,
      total: 90000,
      discountAmount: 0,
      coupon: null,
      items: [{ productName: 'Cafe', variantInfo: '', quantity: 1, unitPrice: 90000 }],
    };
    const html = buildInvoiceHtml(order);
    expect(html).toContain('Gratis');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/invoice.test.ts`
Expected: FAIL — "Cannot find module '@/lib/invoice'"

- [ ] **Step 3: Create lib/invoice.ts**

```typescript
// lib/invoice.ts

export interface InvoiceOrder {
  id: string;
  status: string;
  total: number;
  discountAmount: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingDepartment?: string | null;
  paymentReference?: string | null;
  createdAt: string;
  items: Array<{
    productName: string;
    variantInfo: string;
    quantity: number;
    unitPrice: number;
  }>;
  coupon?: { code: string; discountType: string; discountValue: number } | null;
}

export function buildInvoiceHtml(order: InvoiceOrder): string {
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const shippingCost = order.total - subtotal + order.discountAmount;

  const itemRows = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding:8px 4px;border-bottom:1px solid #eee;">
        <strong>${item.productName}</strong>
        ${item.variantInfo ? `<br><small style="color:#666;">${item.variantInfo}</small>` : ''}
      </td>
      <td style="padding:8px 4px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #eee;text-align:right;">$${item.unitPrice.toLocaleString('es-CO')}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #eee;text-align:right;">$${(item.unitPrice * item.quantity).toLocaleString('es-CO')}</td>
    </tr>`,
    )
    .join('');

  const date = new Date(order.createdAt).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const discountRow =
    order.discountAmount > 0
      ? `<tr><td>Descuento${order.coupon ? ` (${order.coupon.code})` : ''}</td><td>-$${order.discountAmount.toLocaleString('es-CO')}</td></tr>`
      : '';

  const shippingRow =
    shippingCost === 0
      ? `<tr><td>Envio</td><td>Gratis</td></tr>`
      : `<tr><td>Envio</td><td>$${shippingCost.toLocaleString('es-CO')}</td></tr>`;

  const paymentRefRow = order.paymentReference
    ? `<div class="info-item"><label>Referencia ePayco</label><span>${order.paymentReference}</span></div>`
    : '';

  const deptStr = order.shippingDepartment ? `, ${order.shippingDepartment}` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Comprobante de Pago - KPU Cafe</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;color:#333;padding:32px;max-width:700px;margin:0 auto}
    .header{text-align:center;border-bottom:2px solid #6B3F1A;padding-bottom:16px;margin-bottom:24px}
    .header h1{font-size:22px;color:#6B3F1A;margin-top:8px}
    .header p{color:#888;font-size:12px}
    .section{margin-bottom:20px}
    .section-title{font-size:12px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .info-item label{font-size:11px;color:#888;display:block}
    .info-item span{font-weight:600}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;padding:8px 4px;border-bottom:2px solid #6B3F1A;font-size:11px;text-transform:uppercase;color:#888}
    .totals{margin-top:12px}
    .totals td:first-child{color:#666}
    .totals td:last-child{text-align:right;font-weight:600}
    .totals td{padding:4px}
    .total-final td{font-size:15px;color:#6B3F1A;border-top:2px solid #6B3F1A;padding-top:8px}
    .footer{text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa}
    @media print{body{padding:16px}}
  </style>
</head>
<body>
  <div class="header">
    <h1>KPU Cafe</h1>
    <p>Comprobante de Pago</p>
  </div>

  <div class="section">
    <div class="section-title">Informacion del pedido</div>
    <div class="info-grid">
      <div class="info-item"><label>Numero de pedido</label><span>#${order.id.slice(0, 8).toUpperCase()}</span></div>
      <div class="info-item"><label>Fecha</label><span>${date}</span></div>
      ${paymentRefRow}
      <div class="info-item"><label>Estado</label><span>Pagado</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos del destinatario</div>
    <div class="info-grid">
      <div class="info-item"><label>Nombre</label><span>${order.shippingName}</span></div>
      <div class="info-item"><label>Telefono</label><span>${order.shippingPhone}</span></div>
      <div class="info-item" style="grid-column:span 2"><label>Direccion de envio</label><span>${order.shippingAddress}, ${order.shippingCity}${deptStr}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Productos</div>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th style="text-align:center">Cant.</th>
          <th style="text-align:right">Precio unit.</th>
          <th style="text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <table class="totals">
      <tbody>
        <tr><td>Subtotal</td><td>$${subtotal.toLocaleString('es-CO')}</td></tr>
        ${discountRow}
        ${shippingRow}
        <tr class="total-final"><td><strong>Total</strong></td><td><strong>$${order.total.toLocaleString('es-CO')}</strong></td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>kpucafe.com &nbsp;&bull;&nbsp; Cafe especial colombiano</p>
    <p>Gracias por tu compra!</p>
  </div>
</body>
</html>`;
}

export function printInvoice(order: InvoiceOrder): void {
  const html = buildInvoiceHtml(order);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('No se pudo generar la factura');
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  setTimeout(() => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  }, 1000);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/invoice.test.ts`
Expected: PASS — 9 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/invoice.ts lib/__tests__/invoice.test.ts
git commit -m "feat: add invoice HTML generator and print utility"
```

---

## Task 3: OrderStatusPoller Client Component

**Files:**
- Create: `app/pedido/[id]/order-status-poller.tsx`

This Client Component receives the order's initial status. If `pending`, it polls `GET /api/orders/[id]` every 3s (max 20 attempts = 60s). It also owns the action buttons (invoice download, navigation).

- [ ] **Step 1: Create the component**

```typescript
// app/pedido/[id]/order-status-poller.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, Clock, Home, Package, FileText } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { printInvoice, type InvoiceOrder } from '@/lib/invoice';

type OrderStatus = 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

interface OrderStatusPollerProps {
  orderId: string;
  initialStatus: OrderStatus;
  order: InvoiceOrder;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Procesando pago...',   color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  paid:      { label: 'Pago aprobado',         color: 'text-green-500',  bg: 'bg-green-500/10'  },
  preparing: { label: 'Preparando pedido',     color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
  shipped:   { label: 'Pedido enviado',        color: 'text-primary',    bg: 'bg-primary/10'    },
  delivered: { label: 'Pedido entregado',      color: 'text-green-600',  bg: 'bg-green-600/10'  },
  cancelled: { label: 'Pedido cancelado',      color: 'text-red-500',    bg: 'bg-red-500/10'    },
};

export default function OrderStatusPoller({ orderId, initialStatus, order }: OrderStatusPollerProps) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [timedOut, setTimedOut] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();
  const attemptRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (initialStatus !== 'pending') return;

    const poll = async () => {
      attemptRef.current++;
      if (attemptRef.current > 20) {
        stopPolling();
        setTimedOut(true);
        return;
      }
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== 'pending') {
          setStatus(data.status as OrderStatus);
          stopPolling();
        }
      } catch {
        // continue polling on transient errors
      }
    };

    intervalRef.current = setInterval(poll, 3000);
    return stopPolling;
  }, [orderId, initialStatus, stopPolling]);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      printInvoice(order);
    } catch {
      toast({ title: 'Error al generar factura', description: 'Intenta de nuevo', variant: 'destructive' });
    } finally {
      setIsPrinting(false);
    }
  };

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const isPaid = ['paid', 'preparing', 'shipped', 'delivered'].includes(status);
  const isCancelled = status === 'cancelled';
  const isPolling = status === 'pending' && !timedOut;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Status badge */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${cfg.color} ${cfg.bg}`}>
        {isPolling  && <Loader2     className="h-4 w-4 animate-spin" />}
        {isPaid     && <CheckCircle className="h-4 w-4" />}
        {isCancelled && <XCircle    className="h-4 w-4" />}
        {!isPolling && !isPaid && !isCancelled && <Clock className="h-4 w-4" />}
        {cfg.label}
      </div>

      {isPolling && (
        <p className="text-sm text-muted-foreground text-center">
          Esperando confirmacion del pago...
        </p>
      )}

      {timedOut && (
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          El pago esta siendo verificado. Revisa tu correo o consulta tus pedidos.
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <Link href="/" className="btn-kpu-outline flex items-center justify-center gap-2">
          <Home className="h-4 w-4" />
          Volver al inicio
        </Link>

        {isPaid && (
          <>
            <Link href="/mis-pedidos" className="btn-kpu flex items-center justify-center gap-2">
              <Package className="h-4 w-4" />
              Mis pedidos
            </Link>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="btn-kpu-outline flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {isPrinting ? 'Generando...' : 'Descargar factura'}
            </button>
          </>
        )}

        {isCancelled && (
          <Link href="/checkout" className="btn-kpu flex items-center justify-center gap-2">
            Intentar de nuevo
          </Link>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint -- --max-warnings 0 app/pedido/`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/pedido/\[id\]/order-status-poller.tsx
git commit -m "feat: add OrderStatusPoller client component"
```

---

## Task 4: /pedido/[id] Server Component Page

**Files:**
- Create: `app/pedido/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/pedido/[id]/page.tsx
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Header from '@/components/header';
import Footer from '@/components/footer';
import OrderStatusPoller from './order-status-poller';
import { MapPin, Package } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Estado del Pedido | KPU Cafe',
  robots: { index: false },
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/auth');

  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, userId: session.id },
    include: {
      items: true,
      coupon: { select: { code: true, discountType: true, discountValue: true } },
    },
  });

  if (!order) notFound();

  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const shippingCost = order.total - subtotal + order.discountAmount;

  const invoiceOrder = {
    id: order.id,
    status: order.status as string,
    total: order.total,
    discountAmount: order.discountAmount,
    shippingName: order.shippingName,
    shippingPhone: order.shippingPhone,
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    shippingDepartment: order.shippingDepartment,
    paymentReference: order.paymentReference,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      productName: item.productName,
      variantInfo: item.variantInfo,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    coupon: order.coupon ?? null,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-lg">

            {/* Header */}
            <div className="text-center mb-8">
              <p className="text-sm text-muted-foreground mb-1">
                Pedido #{order.id.slice(0, 8).toUpperCase()}
              </p>
              <h1 className="font-display text-2xl font-bold text-card-foreground mb-6">
                Detalle del Pedido
              </h1>
              <OrderStatusPoller
                orderId={order.id}
                initialStatus={order.status as 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'}
                order={invoiceOrder}
              />
            </div>

            {/* Products */}
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Productos
              </h2>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start bg-muted/50 rounded-xl p-3"
                  >
                    <div>
                      <p className="font-medium text-foreground text-sm">{item.productName}</p>
                      {item.variantInfo && (
                        <p className="text-xs text-muted-foreground">{item.variantInfo}</p>
                      )}
                      <p className="text-xs text-muted-foreground">x {item.quantity}</p>
                    </div>
                    <p className="font-semibold text-foreground text-sm whitespace-nowrap">
                      ${(item.unitPrice * item.quantity).toLocaleString('es-CO')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toLocaleString('es-CO')}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Descuento{order.coupon ? ` (${order.coupon.code})` : ''}
                  </span>
                  <span className="text-green-600 font-medium">
                    -${order.discountAmount.toLocaleString('es-CO')}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Envio</span>
                <span>
                  {shippingCost === 0 ? (
                    <span className="text-green-600 font-medium">Gratis</span>
                  ) : (
                    `$${shippingCost.toLocaleString('es-CO')}`
                  )}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-display text-lg text-primary">
                  ${order.total.toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            {/* Shipping address */}
            <div className="bg-muted/50 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Direccion de envio
              </h2>
              <p className="font-medium text-foreground text-sm">{order.shippingName}</p>
              <p className="text-sm text-muted-foreground">{order.shippingPhone}</p>
              <p className="text-sm text-foreground">{order.shippingAddress}</p>
              <p className="text-sm text-foreground">
                {order.shippingCity}
                {order.shippingDepartment ? `, ${order.shippingDepartment}` : ''}
              </p>
            </div>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint -- --max-warnings 0 app/pedido/`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/pedido/\[id\]/page.tsx
git commit -m "feat: add /pedido/[id] server component order detail page"
```

---

## Task 5: Update Checkout Redirects

**Files:**
- Modify: `app/checkout/page.tsx` (lines 424 and 459)

Currently both payment handlers redirect to `/pago-respuesta?status=...`. Change both to `/pedido/${order.id}`.

- [ ] **Step 1: Update redirect in handlePaymentWithSavedCard (line ~424)**

Find this exact string in `app/checkout/page.tsx`:
```typescript
      router.push(`/pago-respuesta?status=${result.status}&orderId=${order.id}&ref=${result.epaycoRef || ''}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Called when CardForm succeeds (new card tokenized)
```

Replace with:
```typescript
      router.push(`/pedido/${order.id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Called when CardForm succeeds (new card tokenized)
```

- [ ] **Step 2: Update redirect in handleCardTokenized (line ~459)**

Find this exact string in `app/checkout/page.tsx`:
```typescript
      router.push(`/pago-respuesta?status=${result.status}&orderId=${order.id}&ref=${result.epaycoRef || ''}`);
    } catch (err: any) {
      toast({ title: 'Error al pagar', description: err.message, variant: 'destructive' });
```

Replace with:
```typescript
      router.push(`/pedido/${order.id}`);
    } catch (err: any) {
      toast({ title: 'Error al pagar', description: err.message, variant: 'destructive' });
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint -- --max-warnings 0 app/checkout/page.tsx`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/checkout/page.tsx
git commit -m "feat: redirect post-payment to /pedido/[id] instead of pago-respuesta"
```

---

## Task 6: Add "Ver detalle" Links in mis-pedidos

**Files:**
- Modify: `app/mis-pedidos/page.tsx`

Add a `Link` to `/pedido/{order.id}` inside the `OrderCard` component. Insert it between the toggle `</button>` and the `{expanded && (` block — this makes it always visible below the card header.

`app/mis-pedidos/page.tsx` already has `import Link from 'next/link';` at line 4. No additional import needed.

- [ ] **Step 1: Insert "Ver detalle" link in OrderCard**

In `app/mis-pedidos/page.tsx`, find this exact string (unique in the file):

```typescript
          {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
```

Replace with:

```typescript
          {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      <div className="px-4 sm:px-5 pb-3 flex justify-end">
        <Link href={`/pedido/${order.id}`} className="text-xs font-medium text-primary hover:underline">
          Ver detalle →
        </Link>
      </div>

      {expanded && (
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint -- --max-warnings 0 app/mis-pedidos/page.tsx`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/mis-pedidos/page.tsx
git commit -m "feat: add 'Ver detalle' link to order cards in mis-pedidos"
```

---

## Task 7: Delete app/pago-respuesta

**Files:**
- Delete: `app/pago-respuesta/page.tsx`
- Delete: `app/pago-respuesta/` (directory)

- [ ] **Step 1: Verify no remaining references to pago-respuesta**

Run: `grep -r "pago-respuesta" app/ --include="*.ts" --include="*.tsx" -l`
Expected: empty output (no files should reference it after Task 5)

- [ ] **Step 2: Delete the directory**

```bash
rm -rf app/pago-respuesta
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build 2>&1 | tail -20`
Expected: no errors mentioning `pago-respuesta` or missing modules

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove legacy pago-respuesta page (replaced by /pedido/[id])"
```

---

## Summary

After all 7 tasks:
- `GET /api/orders/[id]` returns full order with items + coupon for authenticated owner
- `lib/invoice.ts` generates HTML invoice and triggers browser print dialog
- `/pedido/[id]` is the canonical order detail page — used post-payment AND from mis-pedidos
- Checkout redirects directly to `/pedido/${order.id}` 
- `mis-pedidos` has "Ver detalle" links per order
- `app/pago-respuesta/` is deleted
