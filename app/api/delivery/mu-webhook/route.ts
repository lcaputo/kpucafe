import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';
import {
  sendDriverAssignedEmail,
  sendOrderPickingUpEmail,
  sendOrderOnTheWayEmail,
  sendOrderDeliveredEmail,
} from '@/lib/email';

export async function POST(req: Request) {
  try {
    const webhookToken = req.headers.get('x-api-key');

    // Validate webhook token against any delivery_settings entry
    const settings = await prisma.deliverySettings.findFirst({
      where: { muWebhookToken: webhookToken || '' },
    });
    if (!settings) {
      return NextResponse.json({ message: 'Invalid webhook token' }, { status: 401 });
    }

    const payload = await req.json();
    const { uuid, status_id, status, num_place, mensajero, phone, vehicle_plate, photo_url, ETA, order_id, url, finish_status } = payload;

    log({
      level: 'info',
      type: 'delivery',
      action: 'mu_webhook_received',
      message: `MU webhook: uuid=${uuid} status=${status} (${status_id}) num_place=${num_place}`,
      metadata: payload,
    });

    // Find order by MU UUID
    const order = await prisma.order.findFirst({ where: { muUuid: uuid } });
    if (!order) {
      log({ level: 'warn', type: 'delivery', action: 'mu_webhook_order_not_found', message: `No order found for MU uuid=${uuid}` });
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // Get customer email for notifications
    const user = order.userId
      ? await prisma.user.findUnique({ where: { id: order.userId } })
      : null;
    const customerEmail = user?.email;
    const customerName = order.shippingName;

    const baseEmailData = customerEmail
      ? { to: customerEmail, orderId: order.id, customerName }
      : null;

    // Process based on MU status
    switch (status_id) {
      case 2: // on_hold - waiting for driver
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'on_hold' },
        });
        break;

      case 3: // assigned - driver accepted
        await prisma.order.update({
          where: { id: order.id },
          data: {
            muStatus: 'assigned',
            muDriverName: mensajero || null,
            muDriverPhone: phone || null,
            muDriverPlate: vehicle_plate || null,
            muTrackingUrl: url || null,
            muEta: ETA || null,
          },
        });
        if (baseEmailData) {
          sendDriverAssignedEmail({
            ...baseEmailData,
            driverName: mensajero || 'Mensajero',
            driverPhone: phone || '',
            driverPlate: vehicle_plate || '',
            trackingUrl: url,
            eta: ETA,
          }).catch(() => {});
        }
        break;

      case 4: // in_progress
        if (num_place === 1) {
          // Driver at store picking up
          await prisma.order.update({
            where: { id: order.id },
            data: { muStatus: 'picking_up' },
          });
          if (baseEmailData) {
            sendOrderPickingUpEmail(baseEmailData).catch(() => {});
          }
        } else if (num_place === 2) {
          // Driver heading to customer
          await prisma.order.update({
            where: { id: order.id },
            data: { muStatus: 'delivering', status: 'shipped' },
          });
          if (baseEmailData) {
            sendOrderOnTheWayEmail({
              ...baseEmailData,
              driverName: order.muDriverName || mensajero || 'Mensajero',
              driverPhone: order.muDriverPhone || phone || '',
              driverPlate: order.muDriverPlate || vehicle_plate || '',
              trackingUrl: order.muTrackingUrl || url,
            }).catch(() => {});
          }
        }
        break;

      case 5: // finished
        if (finish_status === 1) {
          await prisma.order.update({
            where: { id: order.id },
            data: { muStatus: 'finished', status: 'delivered' },
          });
          if (baseEmailData) {
            sendOrderDeliveredEmail(baseEmailData).catch(() => {});
          }
        } else {
          await prisma.order.update({
            where: { id: order.id },
            data: { muStatus: 'failed_delivery' },
          });
          log({ level: 'warn', type: 'delivery', action: 'mu_delivery_failed', message: `Delivery failed for order ${order.id}`, metadata: payload });
        }
        break;

      case 6: // cancel
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'cancelled' },
        });
        log({ level: 'warn', type: 'delivery', action: 'mu_service_cancelled', message: `MU service cancelled for order ${order.id}`, metadata: payload });
        break;
    }

    return NextResponse.json({ message: 'OK' });
  } catch (err: any) {
    log({ level: 'error', type: 'delivery', action: 'mu_webhook_error', message: err.message, error: err.stack });
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}
