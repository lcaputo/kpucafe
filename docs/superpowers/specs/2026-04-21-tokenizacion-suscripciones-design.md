# Diseño: Tokenización de Tarjetas y Módulo de Suscripciones

**Fecha:** 2026-04-21  
**Estado:** Aprobado  
**Alcance:** Reemplazo completo del widget ePayco por tokenización directa + módulo de suscripciones con cobros recurrentes automáticos

---

## Contexto

KPU Cafe actualmente usa el widget popup de ePayco (`checkout.js`) para todos los pagos. No existe tokenización ni cobros recurrentes reales — el modelo `Subscription` en DB solo tiene manejo de estado sin vínculo a pagos.

**Objetivo:** Reemplazar el widget por un formulario de tarjeta propio con tokenización ePayco (el token nunca expone datos sensibles), guardar métodos de pago por usuario, y construir un sistema completo de suscripciones con cobros automáticos diarios via cron.

**Estrategia de migración:** Reemplazo completo (Opción 2) — sin período de coexistencia con el sistema antiguo, dado que no hay usuarios en producción.

---

## 1. Schema de Base de Datos

### Nueva tabla: `payment_methods`

```prisma
model PaymentMethod {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  tokenId    String   @map("token_id")        // token ePayco
  franchise  String                            // visa, mastercard, etc.
  mask       String                            // últimos 4 dígitos
  expMonth   String   @map("exp_month")
  expYear    String   @map("exp_year")
  cardHolder String   @map("card_holder")
  isDefault  Boolean  @default(false) @map("is_default")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscriptions Subscription[]
  billingRecords BillingRecord[]

  @@map("payment_methods")
}
```

### Nueva tabla: `billing_records`

```prisma
enum BillingStatus {
  approved
  rejected
  pending
  failed

  @@map("billing_status")
}

model BillingRecord {
  id             String        @id @default(uuid()) @db.Uuid
  subscriptionId String        @map("subscription_id") @db.Uuid
  orderId        String?       @map("order_id") @db.Uuid
  paymentMethodId String       @map("payment_method_id") @db.Uuid
  amount         Int
  status         BillingStatus
  epaycoRef      String?       @map("epayco_ref")
  errorMessage   String?       @map("error_message")
  retryCount     Int           @default(0) @map("retry_count")
  createdAt      DateTime      @default(now()) @map("created_at") @db.Timestamptz

  subscription  Subscription  @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  order         Order?        @relation(fields: [orderId], references: [id], onDelete: SetNull)
  paymentMethod PaymentMethod @relation(fields: [paymentMethodId], references: [id])

  @@map("billing_records")
}
```

### Modificaciones a `Subscription`

Campos añadidos:
```prisma
planId          String?   @map("plan_id") @db.Uuid          // FK → subscription_plans
paymentMethodId String?   @map("payment_method_id") @db.Uuid // FK → payment_methods
nextBillingDate DateTime  @map("next_billing_date") @db.Date
planName        String    @map("plan_name")                  // snapshot del nombre del plan
```

Relaciones añadidas:
```prisma
plan          SubscriptionPlan? @relation(fields: [planId], references: [id])
paymentMethod PaymentMethod?    @relation(fields: [paymentMethodId], references: [id])
billingRecords BillingRecord[]
```

### Archivos a eliminar del schema
- El campo `nextDeliveryDate` en `Subscription` se renombra conceptualmente a `nextBillingDate` (mismo campo, mismo propósito)

---

## 2. Capa de API

### Nuevos Route Handlers

#### Métodos de pago (`app/api/payment-methods/`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/payment-methods/tokenize` | Proxy a ePayco tokenize API usando `EPAYCO_PRIVATE_KEY`. Recibe datos de tarjeta, devuelve `{ token_id, franchise, mask }`. Nunca almacena datos de tarjeta. |
| `GET` | `/api/payment-methods` | Lista métodos de pago del usuario autenticado |
| `POST` | `/api/payment-methods` | Guarda un nuevo PaymentMethod en DB a partir de un token |
| `DELETE` | `/api/payment-methods/[id]` | Elimina método de pago (verifica ownership) |
| `PATCH` | `/api/payment-methods/[id]/default` | Marca como predeterminado |
| `POST` | `/api/payment-methods/[id]/charge` | Cobra un monto al token guardado via ePayco. Requiere `{ amount, orderId?, subscriptionId? }` |

#### Suscripciones (extensiones)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/subscriptions` | Crear suscripción (reescritura: requiere planId, productId, variantId, paymentMethodId, shippingAddressId) |
| `PUT` | `/api/subscriptions/[id]/plan` | Cambiar plan de suscripción |
| `GET` | `/api/subscriptions/[id]/billing` | Historial de BillingRecords de esa suscripción |

#### Billing cron

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/subscriptions/process-billing` | Protegido con `Authorization: Bearer BILLING_SECRET`. Procesa todos los cobros del día. |

#### Admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/admin/subscriptions` | Todas las suscripciones con perfil + plan + método de pago |
| `GET` | `/api/admin/subscriptions/stats` | MRR, activas, pausadas, canceladas, churn 30d |
| `GET` | `/api/admin/subscriptions/[id]/billing` | Historial de cobros de una suscripción |
| `POST` | `/api/admin/subscriptions/[id]/charge` | Reintentar cobro fallido |

### Archivos eliminados
- `hooks/useEpayco.tsx`
- `app/api/payments/epayco-key/route.ts`
- `app/api/payments/epayco-webhook/route.ts`

---

## 3. Frontend — Checkout

### Nuevo componente: `components/CardForm.tsx`

Formulario de tarjeta con campos: número, nombre en tarjeta, vencimiento (MM/AA), CVC. Al submit:
1. Llama a `POST /api/payment-methods/tokenize` con los datos
2. Si `saveCard=true`, llama a `POST /api/payment-methods` para guardar el token
3. Devuelve el `paymentMethodId` al componente padre para ejecutar el cobro

Checkbox "Guardar para futuras compras" — visible solo si el usuario está autenticado.

### Cambios en `app/checkout/page.tsx`

- Se elimina `useEpayco` y toda referencia al widget popup
- Nuevo hook `hooks/useCardPayment.ts` reemplaza a `useEpayco`
- En el paso "Pago" (step 3):
  - Si el usuario tiene tarjetas guardadas: mostrar lista con botón "Pagar" por cada una + opción "Usar otra tarjeta"
  - Si no tiene tarjetas: mostrar `CardForm` directamente
- Flujo de pago:
  1. Crear orden via `POST /api/orders`
  2. Tokenizar si es tarjeta nueva + guardar si checkbox activo
  3. Cobrar via `POST /api/payment-methods/[id]/charge`
  4. Redirigir a `/pago-respuesta` con resultado (el cobro por token es síncrono — no hay polling)

### Nuevo hook: `hooks/useCardPayment.ts`

Encapsula: listar tarjetas guardadas del usuario, tokenizar tarjeta nueva, ejecutar cobro, estados de loading/error.

---

## 4. Frontend — Wizard de Suscripción

### Nueva página: `app/suscribirse/page.tsx`

Wizard de 3 pasos. Requiere autenticación (redirect a `/auth?next=/suscribirse?plan=xxx` si no está logueado). Recibe `?plan=xxx` como query param.

**Paso 1 — Elige tu café**
- Grid de productos activos con sus variantes (peso + molienda)
- Panel lateral: resumen del plan seleccionado (nombre, frecuencia, precio)

**Paso 2 — Dirección de entrega**
- Reutiliza el mismo UX de direcciones del checkout (lista de guardadas + formulario nuevo)

**Paso 3 — Método de pago + confirmación**
- Lista de tarjetas guardadas o `CardForm` si no tiene
- Resumen final: plan + café elegido + precio + "Se cobrará cada [frecuencia]"
- Botón "Activar suscripción":
  1. Tokenizar/seleccionar método de pago
  2. Crear orden del primer ciclo
  3. Cobrar primer ciclo
  4. Crear `Subscription` con `status: active`, `nextBillingDate: hoy + frecuencia`
  5. Redirigir a `/mis-suscripciones` con mensaje de éxito

### Cambios en `components/subscription-section.tsx`

El CTA de cada plan cambia de `href="#"` a `href="/suscribirse?plan=[plan.id]"`.

### Reescritura: `app/mis-suscripciones/page.tsx`

- Estado visual por suscripción (activa/pausada/cancelada) con badge de color
- Producto + variante actual, plan, precio
- Próxima fecha de cobro
- Botones: Pausar / Reactivar / Cancelar (con confirmación)
- Historial de cobros (accordion expandible) con estado, monto, fecha, ref ePayco
- Botón "Nueva suscripción" → `/suscribirse`

### Nueva página: `app/mis-metodos-de-pago/page.tsx`

- Lista de tarjetas: franchise icon + `•••• XXXX` + vencimiento
- Marcar como predeterminada
- Eliminar (con confirmación)
- Agregar nueva tarjeta via `CardForm`
- Enlace en el header de usuario o en `/mis-suscripciones`

---

## 5. Frontend — Admin

### Reescritura: `app/admin/suscripciones/page.tsx`

**Dashboard de estadísticas** (cards en la parte superior):
- MRR (suma de precios de suscripciones activas)
- Suscripciones activas / pausadas / canceladas
- Churn rate últimos 30 días (cancelaciones / total)

**Tabla de suscripciones** con filtros por estado:
- Cliente (nombre + email)
- Plan (nombre + frecuencia)
- Café (producto + variante)
- Precio
- Estado (badge)
- Próximo cobro
- Método de pago (`franchise •••• mask`)
- Acciones: historial de cobros, pausar/reactivar/cancelar, cambiar plan, reintentar cobro fallido

### Nueva página: `app/admin/suscripciones/[id]/page.tsx`

Vista detallada con:
- Info completa: cliente, plan, producto, dirección, método de pago
- Historial completo de `BillingRecord` en tabla
- Botones de gestión: pausar/reactivar/cancelar/reintentar cobro/cambiar plan

---

## 6. Sistema de Cobros Recurrentes (Cron)

### Endpoint: `POST /api/subscriptions/process-billing`

**Autenticación:** Header `Authorization: Bearer $BILLING_SECRET`

**Lógica:**
1. Buscar `Subscription` donde `status = active` AND `nextBillingDate <= today`
2. Por cada suscripción:
   a. Crear `Order` con los items del ciclo
   b. Cobrar via ePayco usando `paymentMethodId.tokenId`
   c. **Si aprobado:** crear `BillingRecord(approved)`, avanzar `nextBillingDate += frecuencia`, marcar `Order.status = paid`
   d. **Si rechazado:** crear `BillingRecord(rejected, retryCount+1)`
      - Si `retryCount >= 3`: cambiar `Subscription.status = paused`
      - Si `retryCount < 3`: dejar `nextBillingDate` (reintenta mañana)
3. Retornar `{ processed, approved, failed, paused }`

### Variable de entorno nueva
```
BILLING_SECRET=<secret-aleatorio-largo>
```

Ver `docs/cron-billing.md` para instrucciones de despliegue del cron en el servidor.

---

## 7. Variables de entorno (resumen de cambios)

### Añadir a `.env.local`
```
BILLING_SECRET=<secret>
```

### Mantener
```
DATABASE_URL
JWT_SECRET
JWT_REFRESH_SECRET
EPAYCO_PUBLIC_KEY   ← aún necesario para el CardForm (tokenize)
EPAYCO_PRIVATE_KEY  ← necesario para el proxy de tokenización y cobros
NEXT_PUBLIC_SITE_URL
```

### Eliminar (ya no necesarios)
- Ninguna variable se elimina — `EPAYCO_PUBLIC_KEY` sigue en uso para el formulario de tarjeta en el cliente.

---

## Archivos nuevos (resumen)

| Archivo | Tipo |
|---------|------|
| `components/CardForm.tsx` | Componente React |
| `hooks/useCardPayment.ts` | Hook React |
| `app/suscribirse/page.tsx` | Página wizard |
| `app/mis-metodos-de-pago/page.tsx` | Página usuario |
| `app/api/payment-methods/tokenize/route.ts` | Route Handler |
| `app/api/payment-methods/route.ts` | Route Handler |
| `app/api/payment-methods/[id]/route.ts` | Route Handler |
| `app/api/payment-methods/[id]/default/route.ts` | Route Handler |
| `app/api/payment-methods/[id]/charge/route.ts` | Route Handler |
| `app/api/subscriptions/process-billing/route.ts` | Route Handler |
| `app/api/subscriptions/[id]/billing/route.ts` | Route Handler |
| `app/api/subscriptions/[id]/plan/route.ts` | Route Handler |
| `app/api/admin/subscriptions/stats/route.ts` | Route Handler |
| `app/api/admin/subscriptions/[id]/billing/route.ts` | Route Handler |
| `app/api/admin/subscriptions/[id]/charge/route.ts` | Route Handler |
| `app/admin/suscripciones/[id]/page.tsx` | Página admin |
| `docs/cron-billing.md` | Documentación despliegue |

## Archivos eliminados (resumen)

| Archivo |
|---------|
| `hooks/useEpayco.tsx` |
| `app/api/payments/epayco-key/route.ts` |
| `app/api/payments/epayco-webhook/route.ts` |
