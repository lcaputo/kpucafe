import { prisma } from '@/lib/prisma';
import { muCreateService, MU_CITY_IDS } from '@/lib/mensajeros-urbanos';
import { sendOrderPreparingEmail } from '@/lib/email';
import { log } from '@/lib/logger';

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

  const settings = await prisma.deliverySettings.findUnique({ where: { city: order.shippingCity } });
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
