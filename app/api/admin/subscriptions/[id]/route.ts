import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        product: { select: { name: true } },
        variant: { select: { weight: true, grind: true } },
        plan: { select: { name: true, frequencyLabel: true } },
        paymentMethod: { select: { franchise: true, mask: true, expMonth: true, expYear: true } },
        user: { include: { profile: true } },
      },
    });
    if (!sub) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });
    return NextResponse.json(sub);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message === 'Unauthorized') return NextResponse.json({ message }, { status: 401 });
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { status } = await req.json();
    const allowed = ['active', 'paused', 'cancelled'];
    if (!allowed.includes(status)) {
      return NextResponse.json({ message: 'Estado no válido' }, { status: 400 });
    }
    await prisma.subscription.update({ where: { id }, data: { status } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message === 'Unauthorized') return NextResponse.json({ message }, { status: 401 });
    return NextResponse.json({ message }, { status: 500 });
  }
}
