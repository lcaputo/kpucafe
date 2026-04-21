import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { planId } = await req.json();

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) return NextResponse.json({ message: 'Plan no disponible' }, { status: 400 });

    const result = await prisma.subscription.updateMany({
      where: { id, userId: session.id },
      data: {
        planId,
        planName: plan.name,
        price: plan.price,
        frequency: plan.frequency as any,
      },
    });
    if (result.count === 0) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
