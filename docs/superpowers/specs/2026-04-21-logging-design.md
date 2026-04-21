# Sistema de Logs — Design Spec

**Fecha:** 2026-04-21
**Estado:** Aprobado

## Goal

Implementar un sistema de logging estructurado que capture errores del servidor y acciones de usuarios autenticados, almacene los registros en PostgreSQL durante 90 días, y los exponga en un panel admin con filtros por nivel, tipo, usuario y fecha.

## Architecture

Tabla `AppLog` en la base de datos existente. Un utilitario `lib/logger.ts` escribe de forma fire-and-forget (no bloquea el response). Los Route Handlers llaman al logger en puntos clave. El panel admin consulta vía `GET /api/admin/logs` con filtros y paginación.

**Tech Stack:** Next.js App Router, Prisma 6, PostgreSQL, TypeScript. Sin dependencias nuevas.

---

## Data Model

### Prisma — nuevo modelo `AppLog`

```prisma
model AppLog {
  id        String   @id @default(uuid()) @db.Uuid
  level     String   // "info" | "warn" | "error"
  type      String   // "auth" | "order" | "payment" | "subscription" | "admin" | "system"
  action    String   // e.g. "login_success", "charge_failed"
  message   String
  userId    String?  @map("user_id") @db.Uuid
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  metadata  Json?    // extra context: orderId, subscriptionId, amount, etc.
  error     String?  // exception message/stack — only when level = "error"
  ipAddress String?  @map("ip_address")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([level])
  @@index([type])
  @@index([userId])
  @@index([createdAt])
  @@map("app_logs")
}
```

Also add `appLogs AppLog[]` relation to `User` model.

---

## lib/logger.ts

Exported function `log()` — always fire-and-forget, never throws:

```typescript
export type LogLevel = 'info' | 'warn' | 'error';
export type LogType = 'auth' | 'order' | 'payment' | 'subscription' | 'admin' | 'system';

export interface LogParams {
  level: LogLevel;
  type: LogType;
  action: string;
  message: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  ipAddress?: string;
}

export function log(params: LogParams): void {
  prisma.appLog.create({ data: params }).catch(() => {});
}
```

Usage:
```typescript
import { log } from '@/lib/logger';

log({ level: 'error', type: 'payment', action: 'charge_failed',
  message: 'Cobro rechazado por ePayco', userId: session.id,
  metadata: { subscriptionId, amount }, error: err.message });
```

---

## Integration Points

### type: auth — `app/api/auth/`
| action | level | where |
|---|---|---|
| `login_success` | info | POST /api/auth/login — on success |
| `login_failed` | warn | POST /api/auth/login — wrong password |
| `logout` | info | POST /api/auth/logout |
| `register` | info | POST /api/auth/register — new account |

### type: order — `app/api/orders/`
| action | level | where |
|---|---|---|
| `create_order` | info | POST /api/orders |
| `order_paid` | info | after successful charge |
| `order_cancelled` | warn | PATCH order status = cancelled |

### type: payment — `app/api/payment-methods/`
| action | level | where |
|---|---|---|
| `charge_approved` | info | chargeCard returns approved |
| `charge_rejected` | warn | chargeCard returns rejected |
| `charge_failed` | error | chargeCard throws EpaycoError |
| `card_saved` | info | POST /api/payment-methods |
| `card_deleted` | info | DELETE /api/payment-methods/[id] |

### type: subscription — `app/api/subscriptions/`
| action | level | where |
|---|---|---|
| `subscription_created` | info | POST /api/subscriptions |
| `subscription_paused` | warn | PATCH status = paused |
| `subscription_cancelled` | warn | PATCH status = cancelled |
| `subscription_reactivated` | info | PATCH status = active |
| `billing_approved` | info | process-billing — charge approved |
| `billing_failed` | error | process-billing — charge throws |
| `subscription_auto_paused` | warn | process-billing — 3rd failure |

### type: admin — `app/api/admin/`
| action | level | where |
|---|---|---|
| `product_updated` | info | PATCH /api/admin/products/[id] |
| `coupon_created` | info | POST /api/admin/coupons |
| `admin_charge_retry` | info | POST /api/admin/subscriptions/[id]/charge |

### type: system
| action | level | where |
|---|---|---|
| `billing_cron_run` | info | POST /api/subscriptions/process-billing — start + summary |
| `unhandled_error` | error | catch blocks that currently return 500 with no other log |

---

## API Route

### `GET /api/admin/logs`

Auth: `requireAdmin()`

Query params:
- `level` — filter by log level
- `type` — filter by log type
- `userId` — filter by user UUID
- `from` — ISO date (createdAt >=)
- `to` — ISO date (createdAt <=)
- `page` — default 1
- `limit` — default 50, max 200

Response:
```json
{
  "logs": [
    {
      "id": "...",
      "level": "error",
      "type": "payment",
      "action": "charge_failed",
      "message": "Cobro rechazado por ePayco",
      "userId": "...",
      "userEmail": "user@example.com",
      "metadata": { "subscriptionId": "...", "amount": 45000 },
      "error": "EpaycoError: token inválido",
      "ipAddress": "192.168.1.1",
      "createdAt": "2026-04-21T13:00:00Z"
    }
  ],
  "total": 142,
  "page": 1,
  "totalPages": 3
}
```

### `DELETE /api/admin/logs/cleanup`

Auth: `requireAdmin()`

Deletes all logs where `createdAt < now() - 90 days`. Returns `{ deleted: number }`.

---

## Admin UI — `app/admin/logs/page.tsx`

Client component following existing admin page pattern.

**Filters bar:**
- Dropdown: Level (`Todos` / `Info` / `Advertencia` / `Error`) — badges: gray/blue/yellow/red
- Dropdown: Tipo (`Todos` / `Auth` / `Pedido` / `Pago` / `Suscripción` / `Admin` / `Sistema`)
- Text input: Email de usuario — se pasa como query param `email` al endpoint; el servidor filtra haciendo join con `User` (`where: { user: { email: { contains: email } } }`)
- Date inputs: Desde / Hasta
- Botón "Limpiar filtros"

**Table columns:** Fecha · Level (badge) · Tipo · Acción · Mensaje · Usuario · Detalle

**Detail panel:** Inline accordion per row — shows `metadata` as formatted JSON and `error` as monospace pre block.

**Pagination:** prev/next with page counter.

**Auto-refresh:** Toggle checkbox — refreshes every 30 seconds when active.

**Cleanup button:** "Limpiar logs antiguos" → calls `DELETE /api/admin/logs/cleanup`, shows count deleted.

---

## Admin Layout Nav

Add to sidebar in `app/admin/layout.tsx`:
```tsx
{ href: '/admin/logs', icon: ScrollText, label: 'Logs' }
```

Import `ScrollText` from lucide-react.

---

## Cleanup Strategy

- Retention: 90 days
- Trigger: manual button in admin UI + optionally add to VPS cron
- No automatic background job required — same VPS cron pattern as billing

---

## Out of Scope

- Log shipping to external services (BetterStack, Axiom, etc.)
- Real-time log streaming (WebSockets)
- Per-user log export / download
- Log-based alerting or notifications
