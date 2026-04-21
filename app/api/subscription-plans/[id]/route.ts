import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!plan || !plan.isActive) return NextResponse.json({ message: 'Plan no disponible' }, { status: 404 });
  return NextResponse.json(plan);
}
