import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();

    const [totalOrders, pendingOrders, totalProducts, totalCustomers] =
      await Promise.all([
        prisma.order.count(),
        prisma.order.count({
          where: { status: { in: ['pending', 'paid', 'preparing'] } },
        }),
        prisma.product.count(),
        prisma.profile.count(),
      ]);

    return NextResponse.json({ totalOrders, pendingOrders, totalProducts, totalCustomers });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
