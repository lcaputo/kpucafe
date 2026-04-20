import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const { orderedIds } = await req.json();

    await prisma.$transaction(
      orderedIds.map((id: string, i: number) =>
        prisma.product.update({ where: { id }, data: { sortOrder: i } })
      )
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
