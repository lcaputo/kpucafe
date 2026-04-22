import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';
import {
  sendEnviaInTransitEmail,
  sendEnviaOutForDeliveryEmail,
  sendOrderDeliveredEmail,
} from '@/lib/email';

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
      ? { to: user.email, orderId: order.id, customerName: order.shippingName }
      : null;

    const mapped = mapEnviaStatus(status);

    switch (mapped) {
      case 'picked_up':
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'picked_up' },
        });
        break;

      case 'in_transit':
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'in_transit', status: 'shipped' },
        });
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
        if (baseEmailData) {
          sendEnviaOutForDeliveryEmail(baseEmailData).catch(() => {});
        }
        break;

      case 'delivered':
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: 'finished', status: 'delivered' },
        });
        if (baseEmailData) {
          sendOrderDeliveredEmail(baseEmailData).catch(() => {});
        }
        break;

      case 'exception':
      case 'returned':
        await prisma.order.update({
          where: { id: order.id },
          data: { muStatus: mapped },
        });
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
