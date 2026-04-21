import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function DELETE() {
  try {
    await requireAdmin();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const { count } = await prisma.appLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return NextResponse.json({ deleted: count, cutoff: cutoff.toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message === 'Unauthorized') return NextResponse.json({ message }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ message }, { status: 403 });
    return NextResponse.json({ message }, { status: 500 });
  }
}
