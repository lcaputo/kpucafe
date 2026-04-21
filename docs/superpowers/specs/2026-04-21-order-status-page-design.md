# Order Status Page Design

## Goal

Replace `app/pago-respuesta` with a new `/pedido/[id]` page that serves as both the post-payment confirmation screen and the standalone order detail view accessible from `mis-pedidos`. Includes a full invoice download via browser print-to-PDF.

## Architecture

### Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/pedido/[id]/page.tsx` | Server Component — fetches order via Prisma, renders page shell |
| Create | `app/pedido/[id]/order-status-poller.tsx` | Client Component — polls API when status is pending, shows live badge |
| Create | `app/api/orders/[id]/route.ts` | GET Route Handler — returns order for authenticated owner |
| Create | `lib/invoice.ts` | Client-side invoice HTML generator + iframe print trigger |
| Modify | `app/checkout/page.tsx` | Change post-payment redirect from `/pago-respuesta?...` to `/pedido/[id]` |
| Modify | `app/mis-pedidos/page.tsx` | Add "Ver detalle →" link per order pointing to `/pedido/[id]` |
| Delete | `app/pago-respuesta/` | Entire directory removed |

### Rendering Strategy

- `app/pedido/[id]/page.tsx` is a **Server Component** — fetches `prisma.order.findFirst` directly, no API round-trip on initial load.
- If `order.status === 'pending'`, it passes `initialStatus: 'pending'` and `orderId` to `OrderStatusPoller` (Client Component) which activates polling.
- If order already has a final status (`paid`, `cancelled`), the entire page renders server-side with no client JS beyond the invoice button.
- `OrderStatusPoller` is always rendered but only activates polling when `initialStatus === 'pending'`.

## Data Flow

### Post-payment (arriving from ePayco)

1. ePayco webhook fires → updates `order.status` to `paid` or `cancelled`
2. Checkout redirects browser to `/pedido/[id]`
3. Server Component fetches order from Prisma
4. If `status: paid` → full server render, no polling
5. If `status: pending` (webhook race) → `OrderStatusPoller` polls `GET /api/orders/[id]` every 3 seconds until status changes
6. Once status changes, `OrderStatusPoller` updates UI state and stops polling

### From mis-pedidos

1. `mis-pedidos` renders order list with "Ver detalle →" link per order
2. Navigates to `/pedido/[id]` — same Server Component, same render
3. No polling activated (orders in list already have final status)

### Invoice (client-side)

`lib/invoice.ts` exports a `printInvoice(order)` function:
1. Builds a complete HTML string with:
   - KPU Cafe logo/header
   - "Comprobante de Pago" title
   - Customer name, email
   - Shipping address and city
   - Itemized table: product name, variant info, quantity, unit price
   - Coupon discount (if applied)
   - Total amount
   - ePayco payment reference
   - Order date
   - Footer
2. Creates a hidden `<iframe>`, writes HTML into it
3. Calls `iframe.contentWindow.print()` to open browser print dialog (user saves as PDF)
4. Cleans up iframe after print

## API Route: GET /api/orders/[id]

- Calls `requireAuth()` — 401 if unauthenticated
- `prisma.order.findFirst({ where: { id, userId: session.id } })` — 404 if not found or wrong user
- Includes: `items`, `coupon` (if any)
- Returns full order object (same shape the Server Component uses)

## UI Layout

```
┌─────────────────────────────────┐
│  [Status badge]  Pedido #abc123 │
│                                 │
│  Productos                      │
│  ┌───────────────────────────┐  │
│  │ Café Especial x1  $45.000 │  │
│  └───────────────────────────┘  │
│  Dirección de envío: ...        │
│  Teléfono: ...                  │
│                                 │
│  Subtotal: $45.000              │
│  Descuento: -$5.000             │
│  Total: $40.000                 │
│                                 │
│  Ref ePayco: TXN-...            │
│  Fecha: 21 abr 2026             │
│                                 │
│  [Descargar factura]            │
│  [Ver mis pedidos]              │
└─────────────────────────────────┘
```

Status badges:
- `paid` → green "Pago aprobado"
- `pending` → yellow "Procesando pago..." (with spinner)
- `cancelled` → red "Pago rechazado"
- others → gray badge with raw status

Invoice button only shown when `status === 'paid'`.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Order not found / wrong user | Server Component calls `notFound()` → Next.js 404 page |
| User not authenticated | Server Component redirects to `/auth` |
| Polling timeout (60s, ~20 attempts) | Stop polling, show: "El pago está siendo verificado. Revisa tu correo o consulta tus pedidos." |
| Invoice print fails | `try/catch` in `lib/invoice.ts`, shows toast error via `useToast` |
| Order cancelled/rejected | No invoice button shown; "Volver al inicio" CTA instead |

## Polling Design

`OrderStatusPoller` uses `useEffect` with `setInterval` (3s interval):
- Starts only if `initialStatus === 'pending'`
- Stops when: status changes to non-pending, or 20 attempts exceeded (60s timeout)
- On status change: updates local state, triggers re-render with new badge/content
- Cleanup: `clearInterval` on unmount
