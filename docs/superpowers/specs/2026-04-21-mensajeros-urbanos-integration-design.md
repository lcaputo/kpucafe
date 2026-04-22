# Integracin Mensajeros Urbanos - KPU Cafe

**Fecha:** 2026-04-21
**Estado:** Aprobado

## Resumen

Integrar la API de Mensajeros Urbanos (MU) en KPU Cafe para ofrecer delivery express automatizado en Barranquilla. Al procesarse el pago, se solicita un mensajero que recoge el cafe en una direccion configurable y lo entrega al cliente. El cliente puede programar el envio y rastrear el estado en tiempo real desde la web. Se envian emails transaccionales en cada cambio de estado.

## Decisiones clave

- **Solo Barranquilla.** El resto de ciudades mantiene el flujo actual (manual, $12,000 fijos).
- **Cotizacion dinamica.** El costo de envio se calcula via MU `/api/calculate` y se muestra al cliente en el checkout.
- **Tracking via estados + info del mensajero.** Sin mapa en vivo propio; se incluye link al tracking de MU para quien quiera ver el mapa.
- **Programacion con franjas horarias.** "Enviar ahora" o seleccionar fecha + franja (configurables desde admin).
- **Config admin esencial.** Direccion de recogida, token MU, franjas horarias.
- **Emails en cada cambio de estado.** Via Resend.
- **Integracion directa en el monolito.** Sin microservicios ni colas.

## 1. Modelo de datos

### Nueva tabla `delivery_settings`

| Campo            | Tipo     | Descripcion                                |
|------------------|----------|--------------------------------------------|
| id               | Int (PK) | Auto-increment                            |
| city             | String   | "Barranquilla"                            |
| enabled          | Boolean  | Kill switch                               |
| muAccessToken    | String   | Token JWT de MU                           |
| muWebhookToken   | String   | Token para validar callbacks de MU        |
| pickupAddress    | String   | Direccion de recogida                     |
| pickupCity       | String   | Ciudad de recogida                        |
| pickupStoreId    | String   | id_point registrado en MU                 |
| pickupStoreName  | String   | Nombre del punto en MU                    |
| pickupPhone      | String   | Telefono del punto                        |
| timeSlots        | Json     | Franjas horarias, ej: `[{"label":"9:00 - 12:00","start":"09:00:00","end":"12:00:00"}]` |
| availableDays    | Int      | Dias hacia adelante para programar (default 7) |
| createdAt        | DateTime | Timestamp                                 |
| updatedAt        | DateTime | Timestamp                                 |

### Nuevos campos en tabla `orders`

| Campo           | Tipo      | Descripcion                                    |
|-----------------|-----------|------------------------------------------------|
| muUuid          | String?   | UUID del servicio en MU (clave para tracking)  |
| muTaskId        | Int?      | ID numerico del servicio en MU                 |
| muStatus        | String?   | Estado MU: on_hold, assigned, picking_up, delivering, finished, failed_delivery, cancelled, error |
| muDriverName    | String?   | Nombre del mensajero                           |
| muDriverPhone   | String?   | Telefono del mensajero                         |
| muDriverPlate   | String?   | Placa del vehiculo                             |
| muTrackingUrl   | String?   | URL de tracking publica de MU                  |
| muEta           | String?   | ETA estimado                                   |
| scheduledDate   | DateTime? | Fecha/hora programada (null = inmediato)       |
| shippingCost    | Decimal?  | Costo real del envio                           |
| deliveryMethod  | String?   | "mensajeros_urbanos" o "standard"              |

## 2. Flujo del checkout

### Deteccion de Barranquilla

Cuando el cliente selecciona una direccion con `city = "Barranquilla"` y MU esta habilitado en `delivery_settings`:

1. **Cotizacion dinamica** -- Se llama a `GET /api/delivery/quote?address=...&city=Barranquilla`. El backend consulta `delivery_settings`, llama a MU `/api/calculate` con coordenadas origen (pickup) y destino (cliente), y retorna el costo real. Este reemplaza los $12,000 fijos.

2. **Opcion de programacion** -- Aparece un bloque debajo de la direccion:
   - Radio: "Enviar ahora" (default) / "Programar envio"
   - Si programa: selector de fecha (manana a +N dias) + selector de franja horaria (las de `delivery_settings.timeSlots`)

3. **Indicador visual** -- Badge "Envio con Mensajeros Urbanos" para que el cliente sepa que es delivery express.

4. **Resumen** -- En el paso de revision: costo cotizado, metodo "Mensajeros Urbanos", fecha/franja si programo.

### Otras ciudades

Sin cambios. $12,000 fijos, envio manual.

## 3. Flujo post-pago

### Trigger

Cuando el webhook de ePayco confirma pago y `order.deliveryMethod === "mensajeros_urbanos"`:

1. Llamar MU `POST /api/create` con:
   - `type_service = 4` (domicilio)
   - `roundtrip = 0` (solo ida, pago online)
   - `declared_value` = total del pedido
   - `city = 4` (Barranquilla)
   - `start_date` / `start_time` = fecha programada o fecha/hora actual
   - `coordinates` con datos del cliente y productos
   - `store_id` = `delivery_settings.pickupStoreId`
   - `payment_type = "3"` (pago online)

2. Guardar `uuid` -> `order.muUuid`, `task_id` -> `order.muTaskId`

3. Orden pasa a estado `preparing`

4. Email al cliente: "Tu pedido esta en preparacion"

### Manejo de errores

Si MU falla: orden queda en `paid` con `muStatus = "error"`. Visible en admin para reintento manual.

## 4. Webhook de MU

### Endpoint

`POST /api/delivery/mu-webhook`

### Validacion

Verificar header `x-api-key` contra `delivery_settings.muWebhookToken`.

### Mapeo de estados

| MU status_id | MU status   | num_place | Accion KPU                      | Estado orden | muStatus        | Email                              |
|--------------|-------------|-----------|----------------------------------|--------------|-----------------|------------------------------------|
| 2            | on_hold     | -         | Actualizar muStatus              | preparing    | on_hold         | -                                  |
| 3            | assigned    | -         | Guardar datos mensajero, ETA, URL| preparing    | assigned        | "Tu mensajero ha sido asignado"   |
| 4            | in_progress | 1         | Mensajero en tienda              | preparing    | picking_up      | "Tu pedido esta siendo recogido"  |
| 4            | in_progress | 2         | Mensajero en camino al cliente   | shipped      | delivering      | "Tu pedido va en camino"          |
| 5            | finished    | 1 (ok)    | Entregado exitosamente           | delivered    | finished        | "Tu pedido fue entregado"         |
| 5            | finished    | 0 (fail)  | Entrega fallida                  | shipped      | failed_delivery | -  (admin notificado)             |
| 6            | cancel      | -         | Cancelado                        | -            | cancelled       | - (admin notificado)              |

## 5. Tracking del cliente

### Pagina `/pedido/[id]`

Se extiende la pagina existente. Cuando `deliveryMethod === "mensajeros_urbanos"`:

- **Timeline visual** con estados amigables:
  - "Pedido confirmado" (paid)
  - "Preparando tu pedido" (preparing)
  - "Buscando mensajero..." (on_hold)
  - "Mensajero asignado" (assigned)
  - "Recogiendo tu pedido" (picking_up)
  - "En camino" (delivering/shipped)
  - "Entregado" (delivered)

- **Card del mensajero** (cuando assigned+): nombre, telefono (clickeable), placa del vehiculo

- **Link tracking MU**: boton "Ver en mapa" que abre `muTrackingUrl` en nueva pestana

- **Polling**: se mantiene el mecanismo existente de polling cada pocos segundos para refrescar el estado

## 6. Panel administrativo

### Nueva pagina: `/admin/configuracion/delivery`

Configuracion de MU:
- Formulario: direccion de recogida, telefono, token MU, webhook token, nombre del punto
- Editor de franjas horarias: agregar/eliminar franjas (label + hora inicio + hora fin)
- Selector de dias disponibles para programacion (1-14)
- Boton "Registrar punto en MU" que llama a `/api/Add-store`
- Toggle activar/desactivar MU

### Cambios en `/admin/envios`

Nueva seccion "Mensajeros Urbanos":
- Lista de pedidos con `deliveryMethod = "mensajeros_urbanos"`
- Columnas: # orden, cliente, direccion, estado MU, mensajero, ETA, programado para
- Badges de color por estado
- Acciones: reintentar envio (si error), ver tracking (abre URL MU), cancelar envio (si no hay mensajero asignado)

### Cambios en `/admin/pedidos`

En detalle expandido de pedido MU: estado MU, datos mensajero, link tracking. Sin modal de guia/transportadora para pedidos MU.

### Nuevas API routes admin

- `GET/PUT /api/admin/delivery-settings` -- Config de delivery
- `POST /api/admin/delivery-settings/register-store` -- Registrar punto en MU
- `POST /api/admin/orders/[id]/retry-mu` -- Reintentar creacion servicio MU
- `POST /api/admin/orders/[id]/cancel-mu` -- Cancelar servicio MU

## 7. Emails transaccionales

### Proveedor

Resend. Nueva dependencia `resend`. Variable de entorno: `RESEND_API_KEY`.

### Servicio

Nuevo modulo `lib/email.ts` con funciones por tipo de notificacion. Templates HTML inline con branding KPU.

### Emails del flujo MU

| Trigger                        | Asunto                                  | Contenido clave                                    |
|--------------------------------|-----------------------------------------|----------------------------------------------------|
| Pago confirmado + MU solicitado| "Tu pedido #X esta en preparacion"      | Resumen pedido, direccion, fecha programada si aplica |
| Mensajero asignado             | "Un mensajero recogera tu pedido"       | Nombre, telefono, placa, ETA, link tracking        |
| Pedido recogido en tienda      | "Tu pedido esta siendo recogido"        | Confirmacion recogida                              |
| En camino                      | "Tu pedido va en camino"                | Nombre/telefono mensajero, link tracking           |
| Entregado                      | "Tu pedido fue entregado"               | Confirmacion                                       |

## 8. Estructura de archivos

### Nuevos archivos

```
lib/
  mensajeros-urbanos.ts         -- Cliente MU: calculate, create, track, cancel, addStore, registerWebhook
  email.ts                      -- Servicio de email con Resend

app/api/
  delivery/
    quote/route.ts              -- GET: cotizar envio MU
    mu-webhook/route.ts         -- POST: recibir callbacks de MU
  admin/
    delivery-settings/
      route.ts                  -- GET/PUT: config de delivery
      register-store/route.ts   -- POST: registrar punto en MU
    orders/[id]/
      retry-mu/route.ts         -- POST: reintentar envio MU
      cancel-mu/route.ts        -- POST: cancelar envio MU

app/admin/
  configuracion/
    delivery/page.tsx           -- UI config MU

prisma/
  migrations/xxx                -- Nueva tabla + campos en orders
```

### Archivos modificados

```
prisma/schema.prisma            -- delivery_settings + campos MU en orders
app/checkout/page.tsx           -- Cotizacion dinamica, selector programacion
app/api/payments/epayco-webhook/route.ts -- Trigger creacion servicio MU
app/pedido/[id]/page.tsx        -- Estado MU, info mensajero, link tracking
app/admin/envios/page.tsx       -- Seccion Mensajeros Urbanos
app/admin/pedidos/page.tsx      -- Info MU en detalle pedido
```

### Dependencias nuevas

- `resend` -- Envio de emails transaccionales

### Variables de entorno nuevas

- `RESEND_API_KEY` -- API key de Resend

## 9. API de Mensajeros Urbanos - Referencia rapida

- **Base URL prod:** `https://mu-integraciones.mensajerosurbanos.com`
- **Auth:** Header `access_token` con JWT pre-provisionado
- **Barranquilla city ID:** `4`
- **Endpoints usados:**
  - `POST /api/calculate` -- Cotizar
  - `POST /api/Add-store` -- Registrar punto de recogida
  - `POST /api/create` -- Crear servicio de delivery
  - `POST /api/track` -- Consultar estado (backup del webhook)
  - `POST /api/cancel` -- Cancelar servicio
  - `POST /api/webhook` -- Registrar endpoint de webhook
- **Programacion:** Si `start_date`/`start_time` es futuro, MU lo lanza 15 min antes automaticamente
- **Cancelacion via API:** Solo si no hay mensajero asignado (status < 3)
