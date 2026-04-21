import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();

    const subscriptions = await prisma.subscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { name: true } },
        variant: { select: { weight: true, grind: true } },
        plan: { select: { name: true, frequencyLabel: true } },
        paymentMethod: { select: { franchise: true, mask: true } },
        user: { include: { profile: { select: { fullName: true } } } },
      },
    });

    return NextResponse.json(subscriptions);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
