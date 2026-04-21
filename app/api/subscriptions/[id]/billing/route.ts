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

    // Verify ownership
    const sub = await prisma.subscription.findFirst({
      where: { id, userId: session.id },
    });
    if (!sub) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });

    const records = await prisma.billingRecord.findMany({
      where: { subscriptionId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json(records);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
