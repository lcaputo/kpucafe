import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { muCreateService, MU_CITY_IDS } from '@/lib/mensajeros-urbanos';
import { log } from '@/lib/logger';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) return NextResponse.json({ message: 'Pedido no encontrado' }, { status: 404 });
    if (order.deliveryMethod !== 'mensajeros_urbanos') {
      return NextResponse.json({ message: 'Este pedido no usa Mensajeros Urbanos' }, { status: 400 });
    }

    const cityId = MU_CITY_IDS[order.shippingCity];
    if (!cityId) return NextResponse.json({ message: 'Ciudad no soportada por MU' }, { status: 400 });

    const settings = await prisma.deliverySettings.findFirst({ where: { city: order.shippingCity, provider: 'mensajeros_urbanos' } });
    if (!settings || !settings.enabled) {
      return NextResponse.json({ message: 'Delivery no habilitado para esta ciudad' }, { status: 400 });
    }

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
      where: { id },
      data: {
        muUuid: result.uuid,
        muTaskId: result.taskId,
        muStatus: result.status === 1 ? 'create' : 'on_hold',
        status: 'preparing',
      },
    });

    log({ level: 'info', type: 'delivery', action: 'mu_retry_success', message: `MU service retried for order ${id}`, userId: session.id, metadata: { muUuid: result.uuid } });
    return NextResponse.json({ message: 'Servicio MU creado exitosamente', uuid: result.uuid });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
