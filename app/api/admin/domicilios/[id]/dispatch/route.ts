import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { triggerMuDeliveryIfNeeded } from '@/lib/delivery';
import { log } from '@/lib/logger';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ message: 'Domicilio no encontrado' }, { status: 404 });
    }
    if (order.source !== 'whatsapp' || order.deliveryMethod !== 'mensajeros_urbanos') {
      return NextResponse.json({ message: 'Este pedido no es un domicilio externo' }, { status: 400 });
    }
    if (order.muUuid) {
      return NextResponse.json({ message: 'Este domicilio ya fue despachado' }, { status: 400 });
    }

    await triggerMuDeliveryIfNeeded(id);

    const updated = await prisma.order.findUnique({ where: { id } });

    log({
      level: 'info',
      type: 'delivery',
      action: 'domicilio_dispatched',
      message: `Domicilio manually dispatched: ${id}`,
      userId: session.id,
    });

    return NextResponse.json({ message: 'Domicilio despachado', order: updated });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
