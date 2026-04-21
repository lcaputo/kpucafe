# Cron Job — Cobros Recurrentes de Suscripciones

Este documento describe cómo configurar el cron job que ejecuta los cobros automáticos de suscripciones activas en KPU Cafe.

## Cómo funciona

Cada día a las 8am (hora Colombia, UTC-5), el cron llama al endpoint protegido:

```
POST https://kpucafe.com/api/subscriptions/process-billing
Authorization: Bearer <BILLING_SECRET>
```

El endpoint busca todas las suscripciones activas cuya `nextBillingDate` sea igual o anterior a hoy, cobra a cada una usando el token de tarjeta guardado, y avanza la fecha al siguiente ciclo. Si un cobro falla, reintenta hasta 3 veces en días consecutivos antes de pausar la suscripción.

---

## Configuración en el servidor (proxmox-infra / VPS)

### 1. Obtener el BILLING_SECRET

El secreto está en `.env.local` del proyecto kpucafe. Asegúrate de que `BILLING_SECRET` esté también configurado en el entorno de producción (variables de entorno del servidor o panel de despliegue).

### 2. Crear el archivo cron

```bash
sudo nano /etc/cron.d/kpucafe-billing
```

Contenido del archivo:

```cron
# Cobros automáticos KPU Cafe — todos los días a las 8am Colombia (13:00 UTC)
0 13 * * * root /usr/bin/curl -s -o /var/log/kpucafe-billing.log -w "\n[HTTP %{http_code}] %{time_total}s\n" \
  -X POST "https://kpucafe.com/api/subscriptions/process-billing" \
  -H "Authorization: Bearer TU_BILLING_SECRET_AQUI" \
  -H "Content-Type: application/json"
```

> **Importante:** Reemplaza `TU_BILLING_SECRET_AQUI` con el valor real de `BILLING_SECRET` del `.env.local`.

### 3. Dar permisos correctos al archivo

```bash
sudo chmod 640 /etc/cron.d/kpucafe-billing
sudo chown root:root /etc/cron.d/kpucafe-billing
```

### 4. Verificar que el cron daemon esté activo

```bash
sudo systemctl status cron
# o en algunos sistemas:
sudo systemctl status crond
```

### 5. Probar manualmente antes del despliegue

```bash
curl -s -X POST "https://kpucafe.com/api/subscriptions/process-billing" \
  -H "Authorization: Bearer TU_BILLING_SECRET_AQUI" \
  -H "Content-Type: application/json"
```

Respuesta esperada:
```json
{
  "processed": 0,
  "approved": 0,
  "failed": 0,
  "paused": 0
}
```

---

## Ver logs

```bash
tail -f /var/log/kpucafe-billing.log
```

---

## Ajuste de zona horaria

Colombia (Bogotá) está en UTC-5 y **no usa horario de verano**. La hora es fija todo el año.

| Hora Colombia | UTC equivalente |
|---------------|-----------------|
| 8:00am        | 13:00 UTC       |
| 9:00am        | 14:00 UTC       |

Si el servidor está configurado en UTC (por defecto en la mayoría de VPS), usa `0 13 * * *` para las 8am Colombia.

Verifica la zona horaria del servidor:
```bash
timedatectl
```

---

## Comportamiento ante fallos de cobro

| Intento | Comportamiento |
|---------|---------------|
| 1er fallo | Reintenta al día siguiente (nextBillingDate no avanza) |
| 2do fallo | Reintenta al día siguiente |
| 3er fallo | Pausa la suscripción (`status = paused`). El cliente debe actualizar su método de pago desde `/mis-suscripciones`. |

Los fallos quedan registrados en la tabla `billing_records` con `status = rejected` y el mensaje de error de ePayco.

---

## Reintentar manualmente un cobro fallido

Desde el panel admin (`/admin/suscripciones`), cada suscripción con cobro fallido tiene un botón "Reintentar cobro" que llama a:

```
POST /api/admin/subscriptions/[id]/charge
```

---

## Variables de entorno requeridas en producción

```
DATABASE_URL
JWT_SECRET
JWT_REFRESH_SECRET
EPAYCO_PUBLIC_KEY
EPAYCO_PRIVATE_KEY
NEXT_PUBLIC_SITE_URL=https://kpucafe.com
BILLING_SECRET=<mismo valor que en el cron>
```
