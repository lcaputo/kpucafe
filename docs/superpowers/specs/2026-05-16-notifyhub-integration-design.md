# Diseño: Integración NotifyHub — Emails y SMS

**Fecha:** 2026-05-16
**Alcance:** Reemplazar Resend con NotifyHub como transporte de notificaciones, añadir SMS para "en camino", y preparar templates para eventos de auth.

---

## 1. Arquitectura general

### Archivo nuevo
`lib/notifyhub.ts` — cliente único que reemplaza `lib/email.ts` y `lib/emails/delivery-notifications.ts`.

Contiene:
- Helper interno `notify(payload)` que hace `fetch` a NotifyHub con API key
- Funciones tipadas por evento (una por tipo de notificación)
- Para "en camino": llama `/email/send` + `/sms/send` en paralelo (`Promise.all`)
- Si NotifyHub está caído: loguea el error pero no rompe el flujo del pedido
- Si `profile.phone` es `null`: omite SMS silenciosamente

### Variables de entorno nuevas
```
NOTIFYHUB_URL=http://localhost:3001
NOTIFYHUB_API_KEY=nh_...
```

### Archivos eliminados
- `lib/email.ts` — tenía bug de recursión infinita, nunca enviaba nada
- `lib/emails/delivery-notifications.ts` — reemplazado por `lib/notifyhub.ts`

### Dependencia eliminada
- `resend` de `package.json`

---

## 2. Templates (13 en total)

Los templates se crean en NotifyHub vía `../notifyhub/prisma/seed.ts`.

### Auth (email)

| Slug | Evento | Variables |
|------|--------|-----------|
| `kpu-welcome` | Registro nuevo usuario | `name` |
| `kpu-forgot-password` | Recuperar contraseña *(template only, sin backend)* | `name`, `resetUrl` |
| `kpu-first-purchase-discount` | Descuento primera compra | `name`, `discountCode`, `discountPercent` |

### Tracking MU — usuario registrado (email)

| Slug | Evento | Variables |
|------|--------|-----------|
| `kpu-order-preparing` | Pedido confirmado, en preparación | `name`, `orderId`, `scheduledDate?` |
| `kpu-order-on-the-way` | En camino (MU) | `name`, `orderId`, `driverName`, `driverPhone`, `driverPlate?`, `trackingUrl?` |

### Tracking Envia — usuario registrado (email)

| Slug | Evento | Variables |
|------|--------|-----------|
| `kpu-envia-shipped` | Despachado con carrier | `name`, `orderId`, `carrier`, `trackingNumber`, `trackUrl`, `deliveryEstimate` |
| `kpu-envia-in-transit` | En tránsito | `name`, `orderId`, `carrier`, `trackUrl` |
| `kpu-envia-out-for-delivery` | En reparto | `name`, `orderId` |

### Tracking domicilios (email, con CTA condicional)

Los templates de domicilio usan `{{#if registrationCta}}` para mostrar el bloque de registro + mención de descuento primera compra solo cuando el usuario no está registrado.

| Slug | Evento | Variables |
|------|--------|-----------|
| `kpu-domicilio-created` | Pedido recibido | `name`, `orderId`, `items`, `total`, `scheduledDate`, `registrationCta?`, `registrationUrl?` |
| `kpu-domicilio-on-the-way` | En camino (domicilio) | `name`, `orderId`, `driverName?`, `driverPhone?`, `trackingUrl?`, `registrationCta?`, `registrationUrl?` |
| `kpu-domicilio-delivered` | Entregado | `name`, `orderId`, `registrationCta?`, `registrationUrl?` |

### SMS — solo "en camino" (texto plano)

| Slug | Evento | Variables |
|------|--------|-----------|
| `kpu-order-on-the-way-sms` | En camino (MU) | `orderId` |
| `kpu-domicilio-on-the-way-sms` | En camino (domicilio) | `orderId` |

Cuerpo del SMS:
> "Tu pedido KPU #{{orderId}} está en camino. Revisa tu correo para el link de seguimiento en tiempo real."

---

## 3. Flujo SMS "en camino"

Cuando un pedido pasa a "en camino" (MU o domicilio), `lib/notifyhub.ts` ejecuta en paralelo:

1. `POST /email/send` → template email con detalles del mensajero
2. `POST /sms/send` → template SMS corto (solo si `profile.phone !== null`)

El `profile.phone` se obtiene via `include: { profile: true }` en la consulta del pedido. Campo ya existente en el schema (`Profile.phone`).

---

## 4. Nuevos triggers

### Welcome email (`kpu-welcome`)
- `app/api/auth/signup/route.ts` → al crear cuenta web exitosamente
- `app/api/auth/complete-registration/route.ts` → cuando usuario de domicilio completa su registro

### Descuento primera compra (`kpu-first-purchase-discount`)
- `app/api/payments/epayco-webhook/route.ts` → al confirmar un pago, se cuenta cuántas órdenes `paid | preparing | shipped | delivered` tiene el usuario. Si es la primera, se envía el email.

### Callers de delivery actualizados
- `app/api/delivery/mu-webhook/route.ts` → reemplaza `lib/email.ts`
- `app/api/delivery/envia-webhook/route.ts` → reemplaza `lib/email.ts`
- `app/api/admin/domicilios/route.ts` → reemplaza `lib/emails/delivery-notifications.ts`

---

## 5. Archivos afectados

| Archivo | Acción |
|---------|--------|
| `lib/notifyhub.ts` | Crear |
| `lib/email.ts` | Eliminar |
| `lib/emails/delivery-notifications.ts` | Eliminar |
| `lib/emails/` | Eliminar directorio (queda vacío) |
| `app/api/delivery/mu-webhook/route.ts` | Actualizar imports y llamadas |
| `app/api/delivery/envia-webhook/route.ts` | Actualizar imports y llamadas |
| `app/api/admin/domicilios/route.ts` | Actualizar imports y llamadas |
| `app/api/payments/epayco-webhook/route.ts` | Añadir trigger descuento primera compra |
| `app/api/auth/signup/route.ts` | Añadir welcome email |
| `app/api/auth/complete-registration/route.ts` | Añadir welcome email |
| `package.json` | Eliminar `resend` |
| `.env.local` | Añadir `NOTIFYHUB_URL`, `NOTIFYHUB_API_KEY` |
| `../notifyhub/prisma/seed.ts` | Añadir 13 templates KPU |

---

## 6. Fuera de alcance

- Backend de recuperación de contraseña (ruta API + UI) — se implementa en ciclo separado
- SMS para estados distintos a "en camino"
- Broadcasts o campañas de marketing vía NotifyHub
