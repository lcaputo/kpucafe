import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();

    const [active, paused, cancelled, recentCancellations] = await Promise.all([
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.subscription.count({ where: { status: 'paused' } }),
      prisma.subscription.count({ where: { status: 'cancelled' } }),
      prisma.subscription.count({
        where: {
          status: 'cancelled',
          updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const mrrResult = await prisma.subscription.aggregate({
      where: { status: 'active' },
      _sum: { price: true },
    });

    const churnRate = active > 0
      ? Math.round((recentCancellations / (active + recentCancellations)) * 100)
      : 0;

    return NextResponse.json({
      active,
      paused,
      cancelled,
      mrr: mrrResult._sum.price || 0,
      churnRate,
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
