import { prisma } from '@/lib/prisma';
import { muCreateService, MU_CITY_IDS } from '@/lib/mensajeros-urbanos';
import { sendOrderPreparingEmail, sendEnviaShippedEmail } from '@/lib/email';
import { log } from '@/lib/logger';
import { enviaGenerate, enviaPickup } from '@/lib/envia';

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

  const settings = await prisma.deliverySettings.findFirst({ where: { city: order.shippingCity, provider: 'mensajeros_urbanos' } });
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

export async function triggerEnviaDeliveryIfNeeded(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, user: true },
  });

  if (!order || order.deliveryMethod !== 'envia') return;

  const settings = await prisma.deliverySettings.findFirst({
    where: { provider: 'envia', enabled: true },
  });
  if (!settings || !settings.enviaApiToken) {
    await prisma.order.update({ where: { id: orderId }, data: { muStatus: 'error' } });
    log({ level: 'error', type: 'delivery', action: 'envia_not_configured', message: `Envia not configured`, metadata: { orderId } });
    return;
  }

  try {
    let totalWeight = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    for (const item of order.items) {
      const qty = item.quantity;
      const w = item.product?.shippingWeight || settings.defaultWeight || 0.5;
      const l = item.product?.shippingLength || settings.defaultLength || 20;
      const wd = item.product?.shippingWidth || settings.defaultWidth || 15;
      const h = item.product?.shippingHeight || settings.defaultHeight || 10;
      totalWeight += w * qty;
      maxLength = Math.max(maxLength, l);
      maxWidth = Math.max(maxWidth, wd);
      maxHeight = Math.max(maxHeight, h);
    }

    const origin = {
      name: settings.pickupStoreName || 'KPU Cafe',
      phone: settings.pickupPhone,
      street: settings.pickupAddress,
      city: settings.pickupCity,
      state: 'AT',
      country: 'CO',
      postalCode: '080001',
    };

    const destination = {
      name: order.shippingName,
      phone: order.shippingPhone,
      street: order.shippingAddress,
      city: order.shippingCity,
      state: order.shippingDepartment || '',
      country: 'CO',
      postalCode: order.shippingPostalCode || '',
    };

    const carrier = order.enviaCarrier || 'coordinadora';
    const service = order.enviaService || 'ground';

    const result = await enviaGenerate({
      apiToken: settings.enviaApiToken,
      carrier,
      service,
      origin,
      destination,
      packages: [{
        content: 'Cafe especializado KPU',
        weight: totalWeight,
        length: maxLength,
        width: maxWidth,
        height: maxHeight,
        declaredValue: order.total,
      }],
      orderReference: order.id,
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        enviaShipmentId: result.shipmentId,
        trackingNumber: result.trackingNumber,
        carrier: result.carrier,
        enviaLabelUrl: result.labelUrl,
        muTrackingUrl: result.trackUrl,
        muStatus: 'label_generated',
        status: 'preparing',
      },
    });

    log({ level: 'info', type: 'delivery', action: 'envia_label_generated', message: `Envia label generated for order ${orderId}`, metadata: { trackingNumber: result.trackingNumber, shipmentId: result.shipmentId } });

    // Schedule pickup
    try {
      const now = new Date();
      const pickupDate = now.toISOString().split('T')[0];

      await enviaPickup({
        apiToken: settings.enviaApiToken,
        carrier,
        pickupDate,
        pickupTimeStart: settings.enviaPickupStart || '09:00',
        pickupTimeEnd: settings.enviaPickupEnd || '17:00',
        pickupAddress: origin,
        trackingNumbers: [result.trackingNumber],
      });

      log({ level: 'info', type: 'delivery', action: 'envia_pickup_scheduled', message: `Pickup scheduled for order ${orderId}` });
    } catch (pickupErr: any) {
      log({ level: 'warn', type: 'delivery', action: 'envia_pickup_failed', message: `Pickup scheduling failed for order ${orderId}`, error: pickupErr.message });
    }

    // Send email
    if (order.user?.email) {
      sendEnviaShippedEmail({
        to: order.user.email,
        orderId: order.id,
        customerName: order.shippingName,
        carrier: result.carrier,
        trackingNumber: result.trackingNumber,
        trackUrl: result.trackUrl,
        deliveryEstimate: order.enviaDeliveryEstimate || '3-5 dias',
      }).catch(() => {});
    }
  } catch (err: any) {
    await prisma.order.update({ where: { id: orderId }, data: { muStatus: 'error' } });
    log({ level: 'error', type: 'delivery', action: 'envia_create_failed', message: `Failed to create Envia shipment for order ${orderId}`, error: err.message });
  }
}
