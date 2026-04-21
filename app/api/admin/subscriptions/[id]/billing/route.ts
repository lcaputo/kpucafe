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
    const records = await prisma.billingRecord.findMany({
      where: { subscriptionId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(records);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message === 'Unauthorized') return NextResponse.json({ message }, { status: 401 });
    return NextResponse.json({ message }, { status: 500 });
  }
}
