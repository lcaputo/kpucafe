import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { log } from '@/lib/logger';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const method = await prisma.paymentMethod.findFirst({
      where: { id, userId: session.id },
    });
    if (!method) return NextResponse.json({ message: 'No encontrado' }, { status: 404 });

    await prisma.paymentMethod.delete({ where: { id } });
    log({ level: 'info', type: 'payment', action: 'card_deleted', message: 'Tarjeta eliminada', userId: session.id, metadata: { paymentMethodId: id } });

    // If no methods left, remove paymentMethodId from active subscriptions
    const remaining = await prisma.paymentMethod.count({ where: { userId: session.id } });
    if (remaining === 0) {
      await prisma.subscription.updateMany({
        where: { userId: session.id, status: { in: ['active', 'paused'] } },
        data: { paymentMethodId: null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
