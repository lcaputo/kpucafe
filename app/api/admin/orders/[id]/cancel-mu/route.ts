import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { muCancel } from '@/lib/mensajeros-urbanos';
import { log } from '@/lib/logger';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ message: 'Pedido no encontrado' }, { status: 404 });
    if (!order.muUuid) return NextResponse.json({ message: 'Este pedido no tiene servicio MU activo' }, { status: 400 });

    const settings = await prisma.deliverySettings.findFirst({ where: { city: order.shippingCity, provider: 'mensajeros_urbanos' } });
    if (!settings) return NextResponse.json({ message: 'Configuracion no encontrada' }, { status: 400 });

    await muCancel({
      accessToken: settings.muAccessToken,
      uuid: order.muUuid,
      cancellationType: 3,
      description: 'Cancelado por admin KPU Cafe',
    });

    await prisma.order.update({
      where: { id },
      data: { muStatus: 'cancelled' },
    });

    log({ level: 'info', type: 'delivery', action: 'mu_cancel', message: `MU service cancelled for order ${id}`, userId: session.id });
    return NextResponse.json({ message: 'Servicio MU cancelado' });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
