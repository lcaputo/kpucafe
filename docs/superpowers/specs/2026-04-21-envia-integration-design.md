# Integracion Envia.com - KPU Cafe

**Fecha:** 2026-04-21
**Estado:** Aprobado

## Resumen

Integrar Envia.com como proveedor de envios nacionales para pedidos fuera de Barranquilla. Se cotizan Coordinadora y Deprisa en paralelo, se usa el mas barato, y al confirmarse el pago se genera la guia automaticamente + se programa pickup. Tracking via webhook con emails transaccionales.

## Decisiones clave

- **Envia.com para todo Colombia excepto Barranquilla** (que usa Mensajeros Urbanos).
- **Dos carriers: Coordinadora y Deprisa.** Se cotizan ambos en paralelo y se usa el mas barato por pedido.
- **Peso y dimensiones por producto.** Almacenados en la tabla `products`, con fallback configurable desde admin.
- **Seguro siempre incluido** via `envia_insurance` por el valor total del pedido.
- **Generacion de guia + pickup automatico post-pago.**
- **Emails transaccionales** en cada cambio de estado (recogido, en transito, entregado).
- **Extension de infraestructura existente** (delivery_settings, lib/delivery.ts, emails, tracking).

## 1. Modelo de datos

### Cambios en tabla `delivery_settings`

| Campo nuevo       | Tipo     | Descripcion                                     |
|-------------------|----------|-------------------------------------------------|
| provider          | String   | "mensajeros_urbanos" o "envia"                  |
| enviaApiToken     | String?  | Bearer token de Envia.com                       |
| enviaCarriers     | Json?    | Carriers a cotizar, ej: `["coordinadora","deprisa"]` |
| enviaPickupStart  | String?  | Hora inicio ventana pickup, ej: "09:00"         |
| enviaPickupEnd    | String?  | Hora fin ventana pickup, ej: "17:00"            |
| defaultWeight     | Float?   | Peso fallback en KG para productos sin datos    |
| defaultLength     | Float?   | Largo fallback en CM                            |
| defaultWidth      | Float?   | Ancho fallback en CM                            |
| defaultHeight     | Float?   | Alto fallback en CM                             |

La columna `city` existente deja de ser unica para Envia — se usara un valor especial `"__national__"` para indicar que aplica a todo el pais excepto ciudades con config MU.

### Cambios en tabla `products`

| Campo nuevo | Tipo   | Descripcion      |
|-------------|--------|------------------|
| weight      | Float? | Peso en KG       |
| length      | Float? | Largo en CM      |
| width       | Float? | Ancho en CM      |
| height      | Float? | Alto en CM       |

### Nuevos campos en tabla `orders`

| Campo                  | Tipo    | Descripcion                                |
|------------------------|---------|--------------------------------------------|
| enviaShipmentId        | Int?    | ID del shipment en Envia                   |
| enviaCarrier           | String? | Carrier usado (coordinadora/deprisa)       |
| enviaService           | String? | Servicio (ground, etc.)                    |
| enviaLabelUrl          | String? | URL del PDF de la guia                     |
| enviaDeliveryEstimate  | String? | Estimado de entrega ("3-5 dias")           |

Campos existentes reutilizados: `trackingNumber`, `carrier`, `deliveryMethod` (ahora acepta "envia").

## 2. Flujo del checkout

### Deteccion automatica

Reglas de routing por ciudad:
1. Ciudad = Barranquilla + MU habilitado → `deliveryMethod = "mensajeros_urbanos"`
2. Cualquier otra ciudad + Envia habilitado → `deliveryMethod = "envia"`
3. Fallback → `deliveryMethod = "standard"` ($12,000 fijos)

### Cotizacion con Envia

Cuando aplica Envia:
1. Frontend llama `POST /api/delivery/envia-quote` con: items del carrito (para calcular peso/dimensiones), direccion destino, ciudad, departamento, codigo postal.
2. Backend calcula paquete sumando productos del carrito (peso total, dimensiones del producto mas grande como base).
3. Backend hace 2 llamadas paralelas a Envia `/ship/rate/` (una por Coordinadora, otra por Deprisa).
4. Compara `totalPrice` y retorna el mas barato.
5. Frontend muestra: costo de envio, carrier seleccionado, estimado de entrega.

### Lo que ve el cliente

- Costo de envio dinamico (el mas barato de los 2 carriers)
- Badge: "Envio nacional con [Carrier]"
- Estimado: "Entrega estimada: [X] dias habiles"
- Sin opcion de programar (a diferencia de MU)

### Datos guardados al crear la orden

`deliveryMethod = "envia"`, `shippingCost`, `enviaCarrier`, `enviaService` — necesarios para generar la guia post-pago.

## 3. Flujo post-pago

### Trigger

Cuando el pago es confirmado y `order.deliveryMethod === "envia"`:

1. **Generar guia** — `POST /ship/generate/` con:
   - Carrier + service guardados en la orden
   - Origen: direccion de recogida de `delivery_settings` (provider=envia)
   - Destino: direccion del cliente
   - Paquete: peso/dimensiones calculados de los items del pedido
   - Seguro: `envia_insurance` con `amount` = total del pedido
   - `orderReference` = orderId
   - `printFormat` = "PDF", `printSize` = "PAPER_4X6"

2. **Guardar respuesta:**
   - `enviaShipmentId` = `data[0].shipmentId`
   - `trackingNumber` = `data[0].trackingNumber`
   - `carrier` = carrier usado
   - `enviaLabelUrl` = `data[0].label`
   - `muTrackingUrl` = `data[0].trackUrl` (reutilizado para link de tracking)

3. **Programar pickup** — `POST /ship/pickup/` con:
   - Carrier: el mismo de la guia
   - Fecha: hoy si antes de la hora de corte, o siguiente dia habil
   - Ventana horaria: `enviaPickupStart` a `enviaPickupEnd` de config
   - Direccion: misma de recogida
   - TrackingNumbers: el que acaba de generar

4. Orden pasa a `preparing`

5. **Email:** "Tu pedido esta en preparacion — sera enviado con [Carrier]. Entrega estimada: [X dias]."

### Manejo de errores

- Si Envia falla al generar guia: orden queda en `paid` con `muStatus = "error"`. Admin puede reintentar.
- Si genera guia pero falla pickup: guia se guarda, pickup se marca para reintento. Admin notificado.
- **Importante:** Verificar siempre `response.meta !== "error"` — Envia retorna HTTP 200 incluso en errores.

## 4. Webhook de Envia

### Registro

Via Queries API: `POST https://queries.envia.com/webhooks` con `type_id: 3` (tracking status update). Se registra desde el admin config o automaticamente al guardar la configuracion.

### Endpoint

`POST /api/delivery/envia-webhook`

### Mapeo de estados

| Envia status pattern       | Accion KPU              | Estado orden | Email                             |
|----------------------------|-------------------------|--------------|-----------------------------------|
| picked_up / recogido       | Paquete recogido        | preparing    | "Tu pedido fue recogido por [Carrier]" |
| in_transit / en_transito   | En transito             | shipped      | "Tu pedido va en camino" + link tracking |
| out_for_delivery / reparto | En reparto              | shipped      | "Tu pedido esta en reparto"       |
| delivered / entregado      | Entregado               | delivered    | "Tu pedido fue entregado"         |
| exception / failed         | Problema con envio      | shipped      | — (admin notificado via log)      |
| returned / devuelto        | Devolucion              | shipped      | — (admin notificado via log)      |

Los estados de Envia varian por carrier. El mapeo sera flexible, agrupando por patrones (contains "transit" → en transito, contains "deliver" → entregado, etc.).

### Validacion

El payload de Envia contiene `trackingNumber`. Se busca la orden por `trackingNumber` en la DB.

## 5. Tracking del cliente

### Pagina `/pedido/[id]`

Cuando `deliveryMethod === "envia"`:

- Badge: "Envio nacional con [Carrier]"
- Numero de guia clickeable
- Link "Rastrear envio" que abre `trackUrl` de Envia en nueva pestana
- Estimado de entrega
- Timeline simplificado: Confirmado → Recogido → En transito → En reparto → Entregado

Reutiliza el mismo componente de tracking de MU pero con estados diferentes.

## 6. Panel administrativo

### Config page `/admin/configuracion/delivery`

Agregar seccion "Envia.com — Envios Nacionales":
- Toggle habilitado/deshabilitado
- API Token (campo password)
- Carriers a cotizar: checkboxes (Coordinadora, Deprisa)
- Direccion de recogida para Envia (puede diferir de MU)
- Ventana de pickup: hora inicio + hora fin
- Paquete fallback: peso, largo, ancho, alto
- Boton "Registrar webhook en Envia"

### Productos `/admin/productos`

Agregar campos en formulario de edicion:
- Weight (kg), Length (cm), Width (cm), Height (cm)
- Opcionales — si no se llenan, se usa fallback del admin

### Envios `/admin/envios`

Nueva seccion "Envios Nacionales (Envia)":
- Lista de pedidos con `deliveryMethod = "envia"`
- Columnas: # orden, cliente, ciudad, carrier, # guia, estado, estimado
- Acciones: descargar guia (PDF), ver tracking, reintentar envio (si error)

### Nuevas API routes

- `POST /api/delivery/envia-quote` — Cotizar con ambos carriers
- `POST /api/delivery/envia-webhook` — Recibir callbacks de Envia
- `POST /api/admin/orders/[id]/retry-envia` — Reintentar guia + pickup
- `PUT /api/admin/delivery-settings` — Extendido para campos Envia

## 7. Emails transaccionales (Envia)

Nuevas funciones en `lib/email.ts`:

| Trigger              | Asunto                                        | Contenido clave                              |
|----------------------|-----------------------------------------------|----------------------------------------------|
| Guia generada        | "Tu pedido #X sera enviado con [Carrier]"     | Carrier, # guia, estimado entrega, link tracking |
| Paquete recogido     | "Tu pedido #X fue recogido"                   | Carrier recogio el paquete                   |
| En transito          | "Tu pedido #X va en camino"                   | Link tracking Envia                          |
| En reparto           | "Tu pedido #X esta en reparto"                | Entrega hoy                                  |
| Entregado            | "Tu pedido #X fue entregado"                  | Confirmacion                                 |

## 8. Estructura de archivos

### Nuevos archivos

```
lib/
  envia.ts                          -- Cliente Envia: rate, generate, track, cancel, pickup, registerWebhook

app/api/
  delivery/
    envia-quote/route.ts            -- POST: cotizar con Coordinadora + Deprisa
    envia-webhook/route.ts          -- POST: recibir callbacks de Envia
  admin/
    orders/[id]/
      retry-envia/route.ts          -- POST: reintentar guia + pickup
```

### Archivos modificados

```
prisma/schema.prisma                -- campos en products, orders, delivery_settings
lib/delivery.ts                     -- extender para Envia
lib/email.ts                        -- emails flujo Envia
app/checkout/page.tsx               -- deteccion Envia, cotizacion, mostrar carrier
app/api/orders/route.ts             -- guardar enviaCarrier, enviaService
app/pedido/[id]/order-status-poller.tsx -- estados Envia + tracking
app/admin/configuracion/delivery/page.tsx -- seccion Envia
app/admin/envios/page.tsx           -- seccion envios Envia
app/admin/productos/page.tsx        -- campos peso/dimensiones
```

## 9. API de Envia.com - Referencia rapida

- **Base URL prod:** `https://api.envia.com/`
- **Queries API:** `https://queries.envia.com/`
- **Geocodes API:** `https://geocodes.envia.com/` (sin auth)
- **Auth:** Header `Authorization: Bearer <token>`
- **Importante:** HTTP 200 incluso en errores — siempre verificar `response.meta !== "error"`
- **Endpoints usados:**
  - `POST /ship/rate/` — Cotizar (1 carrier por request)
  - `POST /ship/generate/` — Generar guia
  - `POST /ship/pickup/` — Programar recogida
  - `POST /ship/generaltrack/` — Consultar tracking
  - `POST /ship/cancel/` — Cancelar guia
  - `POST queries.envia.com/webhooks` — Registrar webhook
  - `GET queries.envia.com/state?country_code=CO` — Codigos de estado Envia
- **Carriers:** coordinadora, deprisa
- **State codes:** Envia usa codigos propios, NO ISO 3166-2. Consultar via Queries API.
- **Balance:** Produccion requiere saldo prepagado. Error 402 si insuficiente.
