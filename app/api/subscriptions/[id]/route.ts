import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { log } from '@/lib/logger';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const sub = await prisma.subscription.findFirst({
      where: { id, userId: session.id },
      include: {
        product: { select: { name: true, imageUrl: true } },
        variant: { select: { weight: true, grind: true } },
        plan: { select: { name: true, frequencyLabel: true } },
        paymentMethod: { select: { franchise: true, mask: true } },
      },
    });
    if (!sub) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });
    return NextResponse.json(sub);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { status } = await req.json();

    const allowed = ['active', 'paused', 'cancelled'];
    if (!allowed.includes(status)) {
      return NextResponse.json({ message: 'Estado no válido' }, { status: 400 });
    }

    // Fetch current status to prevent re-activating cancelled subscriptions
    const existing = await prisma.subscription.findFirst({
      where: { id, userId: session.id },
      select: { status: true },
    });
    if (!existing) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });
    if (existing.status === 'cancelled' && status !== 'cancelled') {
      return NextResponse.json({ message: 'No se puede reactivar una suscripción cancelada' }, { status: 409 });
    }

    const result = await prisma.subscription.updateMany({
      where: { id, userId: session.id },
      data: { status },
    });
    if (result.count === 0) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });
    const actionMap: Record<string, string> = {
      active: 'subscription_reactivated',
      paused: 'subscription_paused',
      cancelled: 'subscription_cancelled',
    };
    log({
      level: status === 'cancelled' || status === 'paused' ? 'warn' : 'info',
      type: 'subscription',
      action: actionMap[status] || `subscription_${status}`,
      message: `Suscripción ${status}`,
      userId: session.id,
      metadata: { subscriptionId: id },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
