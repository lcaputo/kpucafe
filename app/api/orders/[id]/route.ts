// app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: { id, userId: session.id },
      include: {
        items: true,
        coupon: { select: { code: true, discountType: true, discountValue: true } },
      },
    });

    if (!order) return NextResponse.json({ message: 'Pedido no encontrado' }, { status: 404 });

    return NextResponse.json(order);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (error.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
