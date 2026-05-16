# NotifyHub Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar Resend con NotifyHub como transporte de notificaciones, añadir SMS para estado "en camino", y agregar emails de bienvenida y descuento primera compra.

**Architecture:** Un único cliente `lib/notifyhub.ts` con funciones tipadas por evento llama a los endpoints `/email/send` y `/sms/send` de NotifyHub via HTTP con API key. Los 13 templates KPU se siembran en NotifyHub. Los archivos `lib/email.ts` y `lib/emails/delivery-notifications.ts` se eliminan.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, fetch nativo, NotifyHub REST API, Handlebars (en NotifyHub), Prisma.

---

## Mapa de archivos

| Archivo | Acción |
|---------|--------|
| `../notifyhub/prisma/seed.ts` | Modificar — agregar 13 templates KPU |
| `lib/notifyhub.ts` | Crear — cliente con todas las funciones de notificación |
| `lib/__tests__/notifyhub.test.ts` | Crear — tests unitarios del cliente |
| `lib/delivery.ts` | Modificar — importar desde `lib/notifyhub.ts` |
| `app/api/delivery/mu-webhook/route.ts` | Modificar — reemplazar imports, simplificar llamadas |
| `app/api/delivery/envia-webhook/route.ts` | Modificar — reemplazar imports |
| `app/api/admin/domicilios/route.ts` | Modificar — reemplazar imports |
| `app/api/auth/signup/route.ts` | Modificar — agregar welcome email |
| `app/api/auth/complete-registration/route.ts` | Modificar — agregar welcome email |
| `app/api/payments/epayco-webhook/route.ts` | Modificar — agregar trigger descuento primera compra |
| `lib/email.ts` | Eliminar |
| `lib/emails/delivery-notifications.ts` | Eliminar |
| `package.json` | Modificar — remover dependencia `resend` |
| `.env.local` | Modificar — agregar `NOTIFYHUB_URL`, `NOTIFYHUB_API_KEY` |

---

## Task 1: Sembrar templates KPU en NotifyHub

**Files:**
- Modify: `../notifyhub/prisma/seed.ts`

- [ ] **Step 1: Agregar los 13 templates KPU al array de templates del seed**

Al final del cuerpo de la función `main()` en `../notifyhub/prisma/seed.ts`, justo antes del cierre `}` de la función (no fuera de ella), agregar:

```typescript
  // ── KPU Cafe templates ─────────────────────────────────────
  const kpuTemplates = [
    {
      name: 'KPU - Bienvenida',
      slug: 'kpu-welcome',
      channel: 'email' as const,
      subject: 'Bienvenido a KPU Cafe, {{name}}',
      body: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;background:#f9f9f9}.btn{background:#2D1810;color:#fff!important;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block}</style></head><body><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd"><div style="padding:24px;background:#2D1810"><h1 style="color:#D4A574;margin:0;font-size:24px">KPU Cafe</h1></div><div style="padding:24px"><p>Hola {{name}},</p><p>Bienvenido a KPU Cafe, tu tienda de café especializado colombiano. Ya puedes explorar nuestra selección de granos y realizar tus pedidos en línea.</p><p><a href="https://kpucafe.com" class="btn">Ir a la tienda</a></p></div><div style="padding:16px 24px;background:#f5f5f5;font-size:12px;color:#666">KPU Cafe — Café Especializado Colombiano</div></div></body></html>',
      variables: ['name'],
      isBase: false,
    },
    {
      name: 'KPU - Recuperar Contraseña',
      slug: 'kpu-forgot-password',
      channel: 'email' as const,
      subject: 'Recupera tu contraseña — KPU Cafe',
      body: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;background:#f9f9f9}.btn{background:#2D1810;color:#fff!important;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block}</style></head><body><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd"><div style="padding:24px;background:#2D1810"><h1 style="color:#D4A574;margin:0;font-size:24px">KPU Cafe</h1></div><div style="padding:24px"><p>Hola {{name}},</p><p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva.</p><p>Este enlace es válido por 15 minutos.</p><p><a href="{{resetUrl}}" class="btn">Restablecer contraseña</a></p><p style="font-size:13px;color:#888">Si no solicitaste este cambio, ignora este correo.</p></div><div style="padding:16px 24px;background:#f5f5f5;font-size:12px;color:#666">KPU Cafe — Café Especializado Colombiano</div></div></body></html>',
      variables: ['name', 'resetUrl'],
      isBase: false,
    },
    {
      name: 'KPU - Descuento Primera Compra',
      slug: 'kpu-first-purchase-discount',
      channel: 'email' as const,
      subject: '¡Gracias por tu primera compra! Aquí tu descuento',
      body: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;background:#f9f9f9}.btn{background:#2D1810;color:#fff!important;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block}.code{background:#FFF8F0;border:2px dashed #D4A574;border-radius:8px;padding:16px 24px;text-align:center;font-size:24px;font-weight:bold;color:#2D1810;letter-spacing:4px;margin:16px 0}</style></head><body><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd"><div style="padding:24px;background:#2D1810"><h1 style="color:#D4A574;margin:0;font-size:24px">KPU Cafe</h1></div><div style="padding:24px"><p>Hola {{name}},</p><p>¡Gracias por confiar en KPU Cafe! Como regalo de bienvenida, te damos un <strong>{{discountPercent}}% de descuento</strong> en tu próxima compra.</p><p>Usa este código al momento del pago:</p><div class="code">{{discountCode}}</div><p><a href="https://kpucafe.com" class="btn">Hacer mi próximo pedido</a></p></div><div style="padding:16px 24px;background:#f5f5f5;font-size:12px;color:#666">KPU Cafe — Café Especializado Colombiano</div></div></body></html>',
      variables: ['name', 'discountCode', 'discountPercent'],
      isBase: false,
    },
    {
      name: 'KPU - Pedido en Preparación',
      slug: 'kpu-order-preparing',
      channel: 'email' as const,
      subject: 'Tu pedido #{{orderId}} está en preparación',
      body: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;background:#f9f9f9}.btn{background:#2D1810;color:#fff!important;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block}</style></head><body><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd"><div style="padding:24px;background:#2D1810"><h1 style="color:#D4A574;margin:0;font-size:24px">KPU Cafe</h1><p style="color:#D4A574;margin:8px 0 0;font-size:14px">Pedido #{{orderId}}</p></div><div style="padding:24px"><p>Hola {{name}},</p><p>Tu pedido ha sido confirmado y lo estamos preparando con cuidado.</p>{{#if scheduledDate}}<p><strong>Entrega programada:</strong> {{scheduledDate}}</p>{{/if}}<p>Te notificaremos cuando esté en camino.</p><p><a href="https://kpucafe.com/pedido/{{orderId}}" class="btn">Ver estado del pedido</a></p></div><div style="padding:16px 24px;background:#f5f5f5;font-size:12px;color:#666">KPU Cafe — Café Especializado Colombiano</div></div></body></html>',
      variables: ['name', 'orderId', 'scheduledDate'],
      isBase: false,
    },
    {
      name: 'KPU - Pedido en Camino (MU)',
      slug: 'kpu-order-on-the-way',
      channel: 'email' as const,
      subject: 'Tu pedido #{{orderId}} va en camino',
      body: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;background:#f9f9f9}.btn{background:#2D1810;color:#fff!important;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block}.info{background:#f9f9f9;padding:16px;border-radius:8px;margin:16px 0}</style></head><body><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd"><div style="padding:24px;background:#2D1810"><h1 style="color:#D4A574;margin:0;font-size:24px">KPU Cafe</h1><p style="color:#D4A574;margin:8px 0 0;font-size:14px">Pedido #{{orderId}}</p></div><div style="padding:24px"><p>Hola {{name}},</p><p>Tu pedido está en camino hacia ti.</p><div class="info"><p style="margin:0 0 8px;font-weight:bold">Información del mensajero</p><p style="margin:0 0 6px"><strong>Nombre:</strong> {{driverName}}</p><p style="margin:0 0 6px"><strong>Teléfono:</strong> {{driverPhone}}</p>{{#if driverPlate}}<p style="margin:0"><strong>Vehículo:</strong> {{driverPlate}}</p>{{/if}}</div>{{#if trackingUrl}}<p><a href="{{trackingUrl}}" class="btn">Rastrear en tiempo real</a></p>{{/if}}</div><div style="padding:16px 24px;background:#f5f5f5;font-size:12px;color:#666">KPU Cafe — Café Especializado Colombiano</div></div></body></html>',
      variables: ['name', 'orderId', 'driverName', 'driverPhone', 'driverPlate', 'trackingUrl'],
      isBase: false,
    },
    {
      name: 'KPU - Despachado con Envia',
      slug: 'kpu-envia-shipped',
      channel: 'email' as const,
      subject: 'Tu pedido #{{orderId}} fue despachado con {{carrier}}',
      body: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;background:#f9f9f9}.btn{background:#2D1810;color:#fff!important;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block}.info{background:#f9f9f9;padding:16px;border-radius:8px;margin:16px 0}</style></head><body><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd"><div style="padding:24px;background:#2D1810"><h1 style="color:#D4A574;margin:0;font-size:24px">KPU Cafe</h1><p style="color:#D4A574;margin:8px 0 0;font-size:14px">Pedido #{{orderId}}</p></div><div style="padding:24px"><p>Hola {{name}},</p><p>Tu pedido fue despachado y será enviado con <strong>{{carrier}}</strong>.</p><div class="info"><p style="margin:0 0 8px;font-weight:bold">Información del envío</p><p style="margin:0 0 6px"><strong>Transportista:</strong> {{carrier}}</p><p style="margin:0 0 6px"><strong>Número de rastreo:</strong> {{trackingNumber}}</p><p style="margin:0"><strong>Entrega estimada:</strong> {{deliveryEstimate}}</p></div><p><a href="{{trackUrl}}" class="btn">Rastrear envío</a></p></div><div style="padding:16px 24px;background:#f5f5f5;font-size:12px;color:#666">KPU Cafe — Café Especializado Colombiano</div></div></body></html>',
      variables: ['name', 'orderId', 'carrier', 'trackingNumber', 'trackUrl', 'deliveryEstimate'],
      isBase: false,
    },
    {
      name: 'KPU - En Tránsito (Envia)',
      slug: 'kpu-envia-in-transit',
      channel: 'email' as const,
      subject: 'Tu pedido #{{orderId}} va en camino con {{carrier}}',
      body: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;background:#f9f9f9}.btn{background:#2D1810;color:#fff!important;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block}</style></head><body><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd"><div style="padding:24px;background:#2D1810"><h1 style="color:#D4A574;margin:0;font-size:24px">KPU Cafe</h1><p style="color:#D4A574;margin:8px 0 0;font-size:14px">Pedido #{{orderId}}</p></div><div style="padding:24px"><p>Hola {{name}},</p><p>Tu pedido va en camino con <strong>{{carrier}}</strong>.</p><p><a href="{{trackUrl}}" class="btn">Rastrear envío</a></p></div><div style="padding:16px 24px;background:#f5f5f5;font-size:12px;color:#666">KPU Cafe — Café Especializado Colombiano</div></div></body></html>',
      variables: ['name', 'orderId', 'carrier', 'trackUrl'],
      isBase: false,
    },
    {
      name: 'KPU - En Reparto (Envia)',
      slug: 'kpu-envia-out-for-delivery',
      channel: 'email' as const,
      subject: 'Tu pedido #{{orderId}} está en reparto — llega hoy',
      body: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;background:#f9f9f9}.btn{background:#2D1810;color:#fff!important;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block}</style></head><body><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd"><div style="padding:24px;background:#2D1810"><h1 style="color:#D4A574;margin:0;font-size:24px">KPU Cafe</h1><p style="color:#D4A574;margin:8px 0 0;font-size:14px">Pedido #{{orderId}}</p></div><div style="padding:24px"><p>Hola {{name}},</p><p>Tu pedido está en reparto y será entregado hoy. Asegúrate de estar en casa.</p><p><a href="https://kpucafe.com/pedido/{{orderId}}" class="btn">Ver pedido</a></p></div><div style="padding:16px 24px;background:#f5f5f5;font-size:12px;color:#666">KPU Cafe — Café Especializado Colombiano</div></div></body></html>',
      variables: ['name', 'orderId'],
      isBase: false,
    },
    {
      name: 'KPU - Domicilio Creado',
      slug: 'kpu-domicilio-created',
      channel: 'email' as const,
      subject: 'Pedido recibido #{{orderId}} — KPU Cafe',
      body: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;background:#f9f9f9}.btn{background:#2D1810;color:#fff!important;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block}.cta{background:#FFF8F0;border:1px solid #D4A574;border-radius:8px;padding:16px;margin-top:24px}</style></head><body><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd"><div style="padding:24px;background:#2D1810"><h1 style="color:#D4A574;margin:0;font-size:24px">KPU Cafe</h1></div><div style="padding:24px"><p>Hola {{name}},</p><p>Tu pedido ha sido recibido y lo estamos preparando.</p><p><strong>Pedido:</strong> #{{orderId}}</p><p><strong>Entrega:</strong> {{scheduledDate}}</p><ul>{{#each items}}<li>{{productName}} x{{quantity}} — ${{unitPrice}}</li>{{/each}}</ul><p style="font-size:18px;font-weight:bold">Total: ${{total}}</p>{{#if registrationCta}}<div class="cta"><p style="margin:0 0 8px;font-weight:bold;color:#2D1810">Crea tu cuenta en KPU Cafe</p><p style="margin:0 0 12px;font-size:14px">Regístrate para hacer pedidos en línea y recibir ofertas exclusivas — incluyendo descuento en tu próxima compra.</p><a href="{{registrationUrl}}" class="btn">Completar mi registro</a></div>{{/if}}</div><div style="padding:16px 24px;background:#f5f5f5;font-size:12px;color:#666">KPU Cafe — Café Especializado Colombiano</div></div></body></html>',
      variables: ['name', 'orderId', 'items', 'total', 'scheduledDate', 'registrationCta', 'registrationUrl'],
      isBase: false,
    },
    {
      name: 'KPU - Domicilio en Camino',
      slug: 'kpu-domicilio-on-the-way',
      channel: 'email' as const,
      subject: 'Tu pedido #{{orderId}} está en camino',
      body: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;background:#f9f9f9}.btn{background:#2D1810;color:#fff!important;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block}.info{background:#f9f9f9;padding:16px;border-radius:8px;margin:16px 0}.cta{background:#FFF8F0;border:1px solid #D4A574;border-radius:8px;padding:16px;margin-top:24px}</style></head><body><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd"><div style="padding:24px;background:#2D1810"><h1 style="color:#D4A574;margin:0;font-size:24px">KPU Cafe</h1><p style="color:#D4A574;margin:8px 0 0;font-size:14px">Pedido #{{orderId}}</p></div><div style="padding:24px"><p>Hola {{name}},</p><p>Tu pedido está en camino hacia ti.</p>{{#if driverName}}<div class="info"><p style="margin:0 0 8px;font-weight:bold">Información del mensajero</p><p style="margin:0 0 6px"><strong>Nombre:</strong> {{driverName}}</p>{{#if driverPhone}}<p style="margin:0"><strong>Teléfono:</strong> {{driverPhone}}</p>{{/if}}</div>{{/if}}{{#if trackingUrl}}<p><a href="{{trackingUrl}}" class="btn">Ver seguimiento en vivo</a></p>{{/if}}{{#if registrationCta}}<div class="cta"><p style="margin:0 0 8px;font-weight:bold;color:#2D1810">Crea tu cuenta y obtén descuento</p><p style="margin:0 0 12px;font-size:14px">Regístrate y recibe un descuento exclusivo en tu próxima compra.</p><a href="{{registrationUrl}}" class="btn">Completar mi registro</a></div>{{/if}}</div><div style="padding:16px 24px;background:#f5f5f5;font-size:12px;color:#666">KPU Cafe — Café Especializado Colombiano</div></div></body></html>',
      variables: ['name', 'orderId', 'driverName', 'driverPhone', 'trackingUrl', 'registrationCta', 'registrationUrl'],
      isBase: false,
    },
    {
      name: 'KPU - Domicilio Entregado',
      slug: 'kpu-domicilio-delivered',
      channel: 'email' as const,
      subject: 'Pedido entregado #{{orderId}} — KPU Cafe',
      body: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:20px;background:#f9f9f9}.btn{background:#2D1810;color:#fff!important;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block}.cta{background:#FFF8F0;border:1px solid #D4A574;border-radius:8px;padding:16px;margin-top:24px}</style></head><body><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd"><div style="padding:24px;background:#2D1810"><h1 style="color:#D4A574;margin:0;font-size:24px">KPU Cafe</h1><p style="color:#D4A574;margin:8px 0 0;font-size:14px">Pedido #{{orderId}}</p></div><div style="padding:24px"><p>Hola {{name}},</p><p>Tu pedido fue entregado exitosamente. ¡Esperamos que disfrutes tu café KPU!</p><p>Gracias por tu compra. Estamos listos para tu próximo pedido.</p><p><a href="https://kpucafe.com" class="btn">Hacer otro pedido</a></p>{{#if registrationCta}}<div class="cta"><p style="margin:0 0 8px;font-weight:bold;color:#2D1810">¿Quieres repetir? Crea tu cuenta</p><p style="margin:0 0 12px;font-size:14px">Regístrate y recibe un descuento exclusivo en tu próxima compra.</p><a href="{{registrationUrl}}" class="btn">Completar mi registro</a></div>{{/if}}</div><div style="padding:16px 24px;background:#f5f5f5;font-size:12px;color:#666">KPU Cafe — Café Especializado Colombiano</div></div></body></html>',
      variables: ['name', 'orderId', 'registrationCta', 'registrationUrl'],
      isBase: false,
    },
    {
      name: 'KPU - SMS En Camino (MU)',
      slug: 'kpu-order-on-the-way-sms',
      channel: 'sms' as const,
      body: 'Tu pedido KPU #{{orderId}} está en camino. Revisa tu correo para el link de seguimiento en tiempo real.',
      variables: ['orderId'],
      isBase: false,
    },
    {
      name: 'KPU - SMS Domicilio En Camino',
      slug: 'kpu-domicilio-on-the-way-sms',
      channel: 'sms' as const,
      body: 'Tu pedido KPU #{{orderId}} está en camino. Revisa tu correo para el link de seguimiento en tiempo real.',
      variables: ['orderId'],
      isBase: false,
    },
  ];

  await prisma.template.createMany({
    data: kpuTemplates,
    skipDuplicates: true,
  });
  console.log('Seeded', kpuTemplates.length, 'KPU Cafe templates');
```

Insertar este bloque justo antes de `main().catch(...)` al final del archivo.

- [ ] **Step 2: Ejecutar el seed en NotifyHub**

```bash
cd ../notifyhub
npx prisma db seed
```

Resultado esperado:
```
Seeded admin: admin@notifyhub.local
Seeded 6 base templates
...
Seeded 13 KPU Cafe templates
```

- [ ] **Step 3: Commit**

```bash
cd ../notifyhub
git add prisma/seed.ts
git commit -m "feat: seed KPU Cafe notification templates"
```

---

## Task 2: Crear lib/notifyhub.ts con tests

**Files:**
- Create: `lib/__tests__/notifyhub.test.ts`
- Create: `lib/notifyhub.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/__tests__/notifyhub.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  sendWelcomeEmail,
  sendFirstPurchaseDiscountEmail,
  sendOrderPreparingEmail,
  sendOrderOnTheWayNotification,
  sendEnviaShippedEmail,
  sendEnviaInTransitEmail,
  sendEnviaOutForDeliveryEmail,
  sendDomicilioCreatedEmail,
  sendDomicilioOnTheWayNotification,
  sendDomicilioDeliveredEmail,
} from '@/lib/notifyhub';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  process.env.NOTIFYHUB_URL = 'http://notifyhub.test';
  process.env.NOTIFYHUB_API_KEY = 'test-key';
  mockFetch.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.NOTIFYHUB_URL;
  delete process.env.NOTIFYHUB_API_KEY;
});

describe('sendWelcomeEmail', () => {
  it('llama a /email/send con template kpu-welcome', async () => {
    await sendWelcomeEmail({ to: 'ana@test.com', name: 'Ana' });
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      'http://notifyhub.test/email/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
        body: expect.stringContaining('"template":"kpu-welcome"'),
      }),
    );
  });
});

describe('sendOrderOnTheWayNotification', () => {
  it('llama a email/send y sms/send en paralelo cuando hay phone', async () => {
    await sendOrderOnTheWayNotification({
      to: 'ana@test.com',
      phone: '+573001234567',
      name: 'Ana',
      orderId: 'abcdef12-0000-0000-0000-000000000000',
      driverName: 'Carlos',
      driverPhone: '+573009876543',
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const urls = mockFetch.mock.calls.map((c) => c[0] as string);
    expect(urls).toContain('http://notifyhub.test/email/send');
    expect(urls).toContain('http://notifyhub.test/sms/send');
  });

  it('omite el SMS cuando phone es null', async () => {
    await sendOrderOnTheWayNotification({
      to: 'ana@test.com',
      phone: null,
      name: 'Ana',
      orderId: 'abcdef12-0000-0000-0000-000000000000',
      driverName: 'Carlos',
      driverPhone: '+573009876543',
    });
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toBe('http://notifyhub.test/email/send');
  });

  it('abrevia el orderId a 8 chars en mayúsculas', async () => {
    await sendOrderOnTheWayNotification({
      to: 'ana@test.com',
      phone: null,
      name: 'Ana',
      orderId: 'abcdef12-0000-0000-0000-000000000000',
      driverName: 'Carlos',
      driverPhone: '+573009876543',
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables.orderId).toBe('ABCDEF12');
  });
});

describe('sendDomicilioOnTheWayNotification', () => {
  it('envía email y SMS cuando hay phone', async () => {
    await sendDomicilioOnTheWayNotification({
      to: 'ana@test.com',
      phone: '+573001234567',
      name: 'Ana',
      orderId: 'abcdef12-0000-0000-0000-000000000000',
      registrationCta: false,
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('no envía SMS cuando phone es null', async () => {
    await sendDomicilioOnTheWayNotification({
      to: 'ana@test.com',
      phone: null,
      name: 'Ana',
      orderId: 'abcdef12-0000-0000-0000-000000000000',
      registrationCta: false,
    });
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

describe('comportamiento sin configuración', () => {
  it('no hace ningún fetch cuando NOTIFYHUB_URL está vacío', async () => {
    process.env.NOTIFYHUB_URL = '';
    await sendWelcomeEmail({ to: 'test@test.com', name: 'Test' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('no lanza error cuando notifyhub devuelve error de red', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));
    await expect(
      sendWelcomeEmail({ to: 'test@test.com', name: 'Test' }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

```bash
npx vitest run lib/__tests__/notifyhub.test.ts
```

Resultado esperado: error de módulo no encontrado (`Cannot find module '@/lib/notifyhub'`).

- [ ] **Step 3: Crear lib/notifyhub.ts**

```typescript
// Client for the NotifyHub notification service.
// Reads NOTIFYHUB_URL and NOTIFYHUB_API_KEY lazily so tests can set env vars.

function baseUrl(): string { return process.env.NOTIFYHUB_URL ?? ''; }
function apiKey(): string { return process.env.NOTIFYHUB_API_KEY ?? ''; }

async function notifyEmail(
  to: string,
  template: string,
  variables: Record<string, unknown>,
): Promise<void> {
  const url = baseUrl();
  const key = apiKey();
  if (!url || !key) return;
  try {
    await fetch(`${url}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ to, template, variables }),
    });
  } catch (err) {
    console.error('[notifyhub] email send failed', err);
  }
}

async function notifySms(
  to: string,
  template: string,
  variables: Record<string, unknown>,
): Promise<void> {
  const url = baseUrl();
  const key = apiKey();
  if (!url || !key) return;
  try {
    await fetch(`${url}/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ to, template, variables }),
    });
  } catch (err) {
    console.error('[notifyhub] sms send failed', err);
  }
}

function shortId(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

// ── Auth ────────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(data: {
  to: string;
  name: string;
}): Promise<void> {
  await notifyEmail(data.to, 'kpu-welcome', { name: data.name });
}

export async function sendFirstPurchaseDiscountEmail(data: {
  to: string;
  name: string;
  discountCode: string;
  discountPercent: number;
}): Promise<void> {
  await notifyEmail(data.to, 'kpu-first-purchase-discount', {
    name: data.name,
    discountCode: data.discountCode,
    discountPercent: data.discountPercent,
  });
}

// ── MU tracking ─────────────────────────────────────────────────────────────

export async function sendOrderPreparingEmail(data: {
  to: string;
  name: string;
  orderId: string;
  scheduledDate?: string;
}): Promise<void> {
  await notifyEmail(data.to, 'kpu-order-preparing', {
    name: data.name,
    orderId: shortId(data.orderId),
    scheduledDate: data.scheduledDate ?? null,
  });
}

export async function sendOrderOnTheWayNotification(data: {
  to: string;
  phone?: string | null;
  name: string;
  orderId: string;
  driverName: string;
  driverPhone: string;
  driverPlate?: string | null;
  trackingUrl?: string | null;
}): Promise<void> {
  const id = shortId(data.orderId);
  await Promise.all([
    notifyEmail(data.to, 'kpu-order-on-the-way', {
      name: data.name,
      orderId: id,
      driverName: data.driverName,
      driverPhone: data.driverPhone,
      driverPlate: data.driverPlate ?? null,
      trackingUrl: data.trackingUrl ?? null,
    }),
    data.phone
      ? notifySms(data.phone, 'kpu-order-on-the-way-sms', { orderId: id })
      : Promise.resolve(),
  ]);
}

// ── Envia tracking ───────────────────────────────────────────────────────────

export async function sendEnviaShippedEmail(data: {
  to: string;
  name: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  trackUrl: string;
  deliveryEstimate: string;
}): Promise<void> {
  await notifyEmail(data.to, 'kpu-envia-shipped', {
    name: data.name,
    orderId: shortId(data.orderId),
    carrier: data.carrier,
    trackingNumber: data.trackingNumber,
    trackUrl: data.trackUrl,
    deliveryEstimate: data.deliveryEstimate,
  });
}

export async function sendEnviaInTransitEmail(data: {
  to: string;
  name: string;
  orderId: string;
  carrier: string;
  trackUrl: string;
}): Promise<void> {
  await notifyEmail(data.to, 'kpu-envia-in-transit', {
    name: data.name,
    orderId: shortId(data.orderId),
    carrier: data.carrier,
    trackUrl: data.trackUrl,
  });
}

export async function sendEnviaOutForDeliveryEmail(data: {
  to: string;
  name: string;
  orderId: string;
}): Promise<void> {
  await notifyEmail(data.to, 'kpu-envia-out-for-delivery', {
    name: data.name,
    orderId: shortId(data.orderId),
  });
}

// ── Domicilio tracking ───────────────────────────────────────────────────────

export async function sendDomicilioCreatedEmail(data: {
  to: string;
  name: string;
  orderId: string;
  items: Array<{ productName: string; quantity: number; unitPrice: number }>;
  total: number;
  scheduledDate: string;
  registrationCta: boolean;
  registrationUrl?: string;
}): Promise<void> {
  await notifyEmail(data.to, 'kpu-domicilio-created', {
    name: data.name,
    orderId: shortId(data.orderId),
    items: data.items,
    total: data.total,
    scheduledDate: data.scheduledDate,
    registrationCta: data.registrationCta,
    registrationUrl: data.registrationUrl ?? null,
  });
}

export async function sendDomicilioOnTheWayNotification(data: {
  to: string;
  phone?: string | null;
  name: string;
  orderId: string;
  driverName?: string;
  driverPhone?: string;
  trackingUrl?: string;
  registrationCta: boolean;
  registrationUrl?: string;
}): Promise<void> {
  const id = shortId(data.orderId);
  await Promise.all([
    notifyEmail(data.to, 'kpu-domicilio-on-the-way', {
      name: data.name,
      orderId: id,
      driverName: data.driverName ?? null,
      driverPhone: data.driverPhone ?? null,
      trackingUrl: data.trackingUrl ?? null,
      registrationCta: data.registrationCta,
      registrationUrl: data.registrationUrl ?? null,
    }),
    data.phone
      ? notifySms(data.phone, 'kpu-domicilio-on-the-way-sms', { orderId: id })
      : Promise.resolve(),
  ]);
}

export async function sendDomicilioDeliveredEmail(data: {
  to: string;
  name: string;
  orderId: string;
  registrationCta: boolean;
  registrationUrl?: string;
}): Promise<void> {
  await notifyEmail(data.to, 'kpu-domicilio-delivered', {
    name: data.name,
    orderId: shortId(data.orderId),
    registrationCta: data.registrationCta,
    registrationUrl: data.registrationUrl ?? null,
  });
}
```

- [ ] **Step 4: Ejecutar los tests para verificar que pasan**

```bash
npx vitest run lib/__tests__/notifyhub.test.ts
```

Resultado esperado: `10 tests passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/notifyhub.ts lib/__tests__/notifyhub.test.ts
git commit -m "feat: add notifyhub client with typed notification functions"
```

---

## Task 3: Actualizar lib/delivery.ts

**Files:**
- Modify: `lib/delivery.ts:3` — cambiar imports
- Modify: `lib/delivery.ts:79-84` — cambiar llamada sendOrderPreparingEmail
- Modify: `lib/delivery.ts:201-210` — cambiar llamada sendEnviaShippedEmail

- [ ] **Step 1: Reemplazar las dos líneas de import**

En `lib/delivery.ts`, reemplazar:
```typescript
import { sendOrderPreparingEmail, sendEnviaShippedEmail } from '@/lib/email';
```
Por:
```typescript
import { sendOrderPreparingEmail, sendEnviaShippedEmail } from '@/lib/notifyhub';
```

- [ ] **Step 2: Actualizar la llamada sendOrderPreparingEmail (línea ~79)**

Reemplazar:
```typescript
      sendOrderPreparingEmail({
        to: order.user.email,
        orderId: order.id,
        customerName: order.shippingName,
        scheduledDate: scheduledLabel,
      }).catch(() => {});
```
Por:
```typescript
      sendOrderPreparingEmail({
        to: order.user.email,
        name: order.shippingName,
        orderId: order.id,
        scheduledDate: scheduledLabel,
      }).catch(() => {});
```

- [ ] **Step 3: Actualizar la llamada sendEnviaShippedEmail (línea ~202)**

Reemplazar:
```typescript
      sendEnviaShippedEmail({
        to: order.user.email,
        orderId: order.id,
        customerName: order.shippingName,
        carrier: result.carrier,
        trackingNumber: result.trackingNumber,
        trackUrl: result.trackUrl,
        deliveryEstimate: order.enviaDeliveryEstimate || '3-5 dias',
      }).catch(() => {});
```
Por:
```typescript
      sendEnviaShippedEmail({
        to: order.user.email,
        name: order.shippingName,
        orderId: order.id,
        carrier: result.carrier,
        trackingNumber: result.trackingNumber,
        trackUrl: result.trackUrl,
        deliveryEstimate: order.enviaDeliveryEstimate || '3-5 dias',
      }).catch(() => {});
```

- [ ] **Step 4: Verificar compilación TypeScript**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/delivery.ts
git commit -m "refactor: use notifyhub client in delivery.ts"
```

---

## Task 4: Actualizar app/api/delivery/mu-webhook/route.ts

**Files:**
- Modify: `app/api/delivery/mu-webhook/route.ts`

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplazar el contenido completo de `app/api/delivery/mu-webhook/route.ts` con:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMuConfig } from '@/lib/delivery-config';
import { log } from '@/lib/logger';
import {
  sendOrderOnTheWayNotification,
  sendDomicilioOnTheWayNotification,
  sendDomicilioDeliveredEmail,
} from '@/lib/notifyhub';
import { signAccessToken } from '@/lib/auth';
import { emitOrderUpdate } from '@/lib/order-events';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kpucafe.com';

async function buildRegistrationUrl(user: { id: string; email: string; registrationComplete: boolean }): Promise<string | undefined> {
  if (user.registrationComplete) return undefined;
  const token = await signAccessToken({ sub: user.id, email: user.email });
  return `${SITE_URL}/completar-registro?token=${encodeURIComponent(token)}`;
}

export async function POST(req: Request) {
  try {
    const webhookToken = req.headers.get('x-api-key');
    const muConfig = getMuConfig();
    if (!webhookToken || webhookToken !== muConfig.webhookToken) {
      return NextResponse.json({ message: 'Invalid webhook token' }, { status: 401 });
    }

    const payload = await req.json();
    const { uuid, status_id, num_place, mensajero, phone, vehicle_plate, url, finish_status } = payload;

    log({
      level: 'info',
      type: 'delivery',
      action: 'mu_webhook_received',
      message: `MU webhook: uuid=${uuid} status=${status_id} num_place=${num_place}`,
      metadata: payload,
    });

    const order = await prisma.order.findFirst({ where: { muUuid: uuid } });
    if (!order) {
      log({ level: 'warn', type: 'delivery', action: 'mu_webhook_order_not_found', message: `No order found for MU uuid=${uuid}` });
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    const user = order.userId
      ? await prisma.user.findUnique({ where: { id: order.userId }, include: { profile: true } })
      : null;

    switch (status_id) {
      case 2: // on_hold
        await prisma.order.update({ where: { id: order.id }, data: { muStatus: 'on_hold' } });
        emitOrderUpdate(order.id, { muStatus: 'on_hold' });
        break;

      case 3: { // assigned — solo domicilios reciben notificación aquí
        const updatedAssigned = await prisma.order.update({
          where: { id: order.id },
          data: {
            muStatus: 'assigned',
            muDriverName: mensajero || null,
            muDriverPhone: phone || null,
            muDriverPlate: vehicle_plate || null,
            muTrackingUrl: url || null,
          },
        });
        emitOrderUpdate(order.id, {
          muStatus: 'assigned',
          muDriverName: updatedAssigned.muDriverName,
          muDriverPhone: updatedAssigned.muDriverPhone,
          muDriverPlate: updatedAssigned.muDriverPlate,
          muTrackingUrl: updatedAssigned.muTrackingUrl,
        });
        if (order.source === 'whatsapp' && user) {
          const registrationUrl = await buildRegistrationUrl(user);
          sendDomicilioOnTheWayNotification({
            to: user.email,
            phone: null, // SMS solo en num_place=2
            name: order.shippingName,
            orderId: order.id,
            driverName: updatedAssigned.muDriverName || undefined,
            driverPhone: updatedAssigned.muDriverPhone || undefined,
            trackingUrl: updatedAssigned.muTrackingUrl || undefined,
            registrationCta: !user.registrationComplete,
            registrationUrl,
          }).catch(() => {});
        }
        break;
      }

      case 4: // in_progress
        if (num_place === 1) {
          await prisma.order.update({ where: { id: order.id }, data: { muStatus: 'picking_up' } });
          emitOrderUpdate(order.id, { muStatus: 'picking_up' });
        } else if (num_place === 2) {
          const updatedDelivering = await prisma.order.update({
            where: { id: order.id },
            data: { muStatus: 'delivering', status: 'shipped' },
          });
          emitOrderUpdate(order.id, {
            status: 'shipped',
            muStatus: 'delivering',
            muDriverName: updatedDelivering.muDriverName,
            muDriverPhone: updatedDelivering.muDriverPhone,
            muDriverPlate: updatedDelivering.muDriverPlate,
            muTrackingUrl: updatedDelivering.muTrackingUrl,
          });
          if (user) {
            if (order.source === 'whatsapp') {
              const registrationUrl = await buildRegistrationUrl(user);
              sendDomicilioOnTheWayNotification({
                to: user.email,
                phone: user.profile?.phone,
                name: order.shippingName,
                orderId: order.id,
                driverName: updatedDelivering.muDriverName || undefined,
                driverPhone: updatedDelivering.muDriverPhone || undefined,
                trackingUrl: updatedDelivering.muTrackingUrl || undefined,
                registrationCta: !user.registrationComplete,
                registrationUrl,
              }).catch(() => {});
            } else {
              sendOrderOnTheWayNotification({
                to: user.email,
                phone: user.profile?.phone,
                name: order.shippingName,
                orderId: order.id,
                driverName: updatedDelivering.muDriverName || mensajero || 'Mensajero',
                driverPhone: updatedDelivering.muDriverPhone || phone || '',
                driverPlate: updatedDelivering.muDriverPlate || vehicle_plate,
                trackingUrl: updatedDelivering.muTrackingUrl || url,
              }).catch(() => {});
            }
          }
        }
        break;

      case 5: { // finished
        if (finish_status === 1) {
          await prisma.order.update({
            where: { id: order.id },
            data: { muStatus: 'finished', status: 'delivered' },
          });
          emitOrderUpdate(order.id, { status: 'delivered', muStatus: 'finished' });
          if (order.source === 'whatsapp' && user) {
            const registrationUrl = await buildRegistrationUrl(user);
            sendDomicilioDeliveredEmail({
              to: user.email,
              name: order.shippingName,
              orderId: order.id,
              registrationCta: !user.registrationComplete,
              registrationUrl,
            }).catch(() => {});
          }
        } else {
          await prisma.order.update({ where: { id: order.id }, data: { muStatus: 'failed_delivery' } });
          emitOrderUpdate(order.id, { muStatus: 'failed_delivery' });
          log({ level: 'warn', type: 'delivery', action: 'mu_delivery_failed', message: `Delivery failed for order ${order.id}`, metadata: payload });
        }
        break;
      }

      case 6: // cancel
        await prisma.order.update({ where: { id: order.id }, data: { muStatus: 'cancelled' } });
        emitOrderUpdate(order.id, { muStatus: 'cancelled' });
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

- [ ] **Step 2: Verificar compilación TypeScript**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/api/delivery/mu-webhook/route.ts
git commit -m "refactor: use notifyhub client in mu-webhook"
```

---

## Task 5: Actualizar app/api/delivery/envia-webhook/route.ts

**Files:**
- Modify: `app/api/delivery/envia-webhook/route.ts`

- [ ] **Step 1: Reemplazar imports y actualizar llamadas**

Reemplazar el contenido completo de `app/api/delivery/envia-webhook/route.ts` con:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';
import {
  sendEnviaInTransitEmail,
  sendEnviaOutForDeliveryEmail,
} from '@/lib/notifyhub';
import { emitOrderUpdate } from '@/lib/order-events';

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
      ? { to: user.email, name: order.shippingName, orderId: order.id }
      : null;

    const mapped = mapEnviaStatus(status);

    switch (mapped) {
      case 'picked_up':
        await prisma.order.update({ where: { id: order.id }, data: { muStatus: 'picked_up' } });
        emitOrderUpdate(order.id, { muStatus: 'picked_up' });
        break;

      case 'in_transit':
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'in_transit', status: 'shipped' },
        });
        emitOrderUpdate(order.id, { status: 'shipped', muStatus: 'in_transit' });
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
        emitOrderUpdate(order.id, { status: 'shipped', muStatus: 'out_for_delivery' });
        if (baseEmailData) {
          sendEnviaOutForDeliveryEmail(baseEmailData).catch(() => {});
        }
        break;

      case 'delivered':
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'finished', status: 'delivered' },
        });
        emitOrderUpdate(order.id, { status: 'delivered', muStatus: 'finished' });
        break;

      case 'exception':
      case 'returned':
        await prisma.order.update({ where: { id: order.id }, data: { muStatus: mapped } });
        emitOrderUpdate(order.id, { muStatus: mapped });
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

- [ ] **Step 2: Verificar compilación TypeScript**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/api/delivery/envia-webhook/route.ts
git commit -m "refactor: use notifyhub client in envia-webhook"
```

---

## Task 6: Actualizar app/api/admin/domicilios/route.ts

**Files:**
- Modify: `app/api/admin/domicilios/route.ts:7` — cambiar import
- Modify: `app/api/admin/domicilios/route.ts:174-191` — cambiar llamada

- [ ] **Step 1: Reemplazar el import de delivery-notifications**

Reemplazar:
```typescript
import { sendDomicilioCreatedEmail } from '@/lib/emails/delivery-notifications';
```
Por:
```typescript
import { sendDomicilioCreatedEmail } from '@/lib/notifyhub';
```

- [ ] **Step 2: Reemplazar la llamada a sendDomicilioCreatedEmail (línea ~174)**

Reemplazar:
```typescript
    if (user) {
      const registrationToken = !user.registrationComplete
        ? await signAccessToken({ sub: user.id, email: user.email })
        : undefined;
      sendDomicilioCreatedEmail({
        to: user.email,
        orderId: order.id,
        customerName: customer.fullName,
        items,
        total,
        scheduledDate: scheduledDate
          ? scheduledDate.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
          : 'Inmediato',
        registrationComplete: user.registrationComplete,
        registrationToken,
      }).catch(() => {});
    }
```
Por:
```typescript
    if (user) {
      const registrationCta = !user.registrationComplete;
      const registrationToken = registrationCta
        ? await signAccessToken({ sub: user.id, email: user.email })
        : undefined;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kpucafe.com';
      sendDomicilioCreatedEmail({
        to: user.email,
        name: customer.fullName,
        orderId: order.id,
        items,
        total,
        scheduledDate: scheduledDate
          ? scheduledDate.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
          : 'Inmediato',
        registrationCta,
        registrationUrl: registrationToken
          ? `${siteUrl}/completar-registro?token=${encodeURIComponent(registrationToken)}`
          : undefined,
      }).catch(() => {});
    }
```

- [ ] **Step 3: Verificar compilación TypeScript**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/domicilios/route.ts
git commit -m "refactor: use notifyhub client in domicilios route"
```

---

## Task 7: Agregar welcome email en rutas de auth

**Files:**
- Modify: `app/api/auth/signup/route.ts`
- Modify: `app/api/auth/complete-registration/route.ts`

- [ ] **Step 1: Agregar import y llamada en signup/route.ts**

Agregar al inicio de los imports de `app/api/auth/signup/route.ts`:
```typescript
import { sendWelcomeEmail } from '@/lib/notifyhub';
```

Después de la línea `log({ level: 'info', ... })` (línea ~34), agregar:
```typescript
    sendWelcomeEmail({ to: user.email, name: fullName }).catch(() => {});
```

- [ ] **Step 2: Agregar import y llamada en complete-registration/route.ts**

Agregar al inicio de los imports de `app/api/auth/complete-registration/route.ts`:
```typescript
import { sendWelcomeEmail } from '@/lib/notifyhub';
```

Cambiar la consulta del usuario para incluir el profile (línea ~23):
```typescript
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    });
```

Después de `await setAuthCookies(accessToken, refreshToken);` (línea ~42), agregar:
```typescript
    sendWelcomeEmail({
      to: user.email,
      name: user.profile?.fullName || user.email,
    }).catch(() => {});
```

- [ ] **Step 3: Verificar compilación TypeScript**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/signup/route.ts app/api/auth/complete-registration/route.ts
git commit -m "feat: send welcome email on registration and registration completion"
```

---

## Task 8: Agregar descuento primera compra en epayco-webhook

**Files:**
- Modify: `app/api/payments/epayco-webhook/route.ts`

- [ ] **Step 1: Agregar import de notifyhub**

Agregar al inicio de los imports de `app/api/payments/epayco-webhook/route.ts`:
```typescript
import { sendFirstPurchaseDiscountEmail } from '@/lib/notifyhub';
```

- [ ] **Step 2: Agregar lógica de descuento primera compra**

Después de la línea `triggerEnviaDeliveryIfNeeded(order.id).catch(() => {});` (línea ~140), agregar:

```typescript
      // Descuento primera compra
      if (order.userId) {
        prisma.order.count({
          where: {
            userId: order.userId,
            status: { in: ['paid', 'preparing', 'shipped', 'delivered'] },
          },
        }).then(async (count) => {
          if (count === 1) {
            const userForDiscount = await prisma.user.findUnique({
              where: { id: order.userId! },
              include: { profile: true },
            });
            if (userForDiscount) {
              sendFirstPurchaseDiscountEmail({
                to: userForDiscount.email,
                name: userForDiscount.profile?.fullName || userForDiscount.email,
                discountCode: 'PRIMERACOMPRA',
                discountPercent: 10,
              }).catch(() => {});
            }
          }
        }).catch(() => {});
      }
```

- [ ] **Step 3: Verificar compilación TypeScript**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/api/payments/epayco-webhook/route.ts
git commit -m "feat: send first purchase discount email after first paid order"
```

---

## Task 9: Agregar variables de entorno

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Agregar las nuevas variables al .env.local**

Agregar al final de `.env.local`:
```
# NotifyHub
NOTIFYHUB_URL=http://localhost:3001
NOTIFYHUB_API_KEY=<api-key-generada-en-notifyhub-admin>
```

El API key se genera desde el panel de NotifyHub en `Configuración > API Keys`. Requiere tener un Application creado para KPU Cafe.

- [ ] **Step 2: Verificar que el servidor arranca sin errores**

```bash
npm run dev
```

Resultado esperado: servidor en `localhost:3000` sin errores de arranque.

---

## Task 10: Limpieza — eliminar archivos y dependencia resend

**Files:**
- Delete: `lib/email.ts`
- Delete: `lib/emails/delivery-notifications.ts`
- Modify: `package.json`

- [ ] **Step 1: Eliminar los archivos de email obsoletos**

```bash
rm lib/email.ts
rm lib/emails/delivery-notifications.ts
rmdir lib/emails
```

- [ ] **Step 2: Remover la dependencia resend**

```bash
npm uninstall resend
```

- [ ] **Step 3: Verificar que no quedan imports rotos**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores. Si hay errores de módulo no encontrado en `@/lib/email` o `@/lib/emails/delivery-notifications`, buscar con:

```bash
grep -r "lib/email" app/ lib/ --include="*.ts" -l
```

Corregir cualquier import restante apuntando a `@/lib/notifyhub`.

- [ ] **Step 4: Build de producción para validación final**

```bash
npm run build
```

Resultado esperado: build exitoso sin errores.

- [ ] **Step 5: Ejecutar todos los tests**

```bash
npx vitest run
```

Resultado esperado: todos los tests pasan.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "chore: remove Resend, delete legacy email files, update env vars"
```
