import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { triggerEnviaDeliveryIfNeeded } from '@/lib/delivery';
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
    if (order.deliveryMethod !== 'envia') {
      return NextResponse.json({ message: 'Este pedido no usa Envia' }, { status: 400 });
    }

    await triggerEnviaDeliveryIfNeeded(id);

    log({ level: 'info', type: 'delivery', action: 'envia_retry', message: `Envia retry for order ${id}`, userId: session.id });
    return NextResponse.json({ message: 'Envio Envia reintentado' });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
