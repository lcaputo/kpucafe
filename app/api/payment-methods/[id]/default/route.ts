import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const method = await prisma.paymentMethod.findFirst({
      where: { id, userId: session.id },
    });
    if (!method) return NextResponse.json({ message: 'No encontrado' }, { status: 404 });

    await prisma.paymentMethod.updateMany({
      where: { userId: session.id },
      data: { isDefault: false },
    });
    await prisma.paymentMethod.update({
      where: { id },
      data: { isDefault: true },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
