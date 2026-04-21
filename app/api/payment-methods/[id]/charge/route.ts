import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { chargeCard, EpaycoError } from '@/lib/epayco';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { amount, orderId } = await req.json();

    if (!amount || !orderId) {
      return NextResponse.json({ message: 'amount y orderId requeridos' }, { status: 400 });
    }

    const method = await prisma.paymentMethod.findFirst({
      where: { id, userId: session.id },
    });
    if (!method) return NextResponse.json({ message: 'Método de pago no encontrado' }, { status: 404 });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ message: 'Pedido no encontrado' }, { status: 404 });

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: { profile: true },
    });

    const result = await chargeCard({
      tokenId: method.tokenId,
      customerId: method.customerId,
      amount,
      description: `KPU Cafe - Pedido #${orderId.slice(0, 8)}`,
      invoiceNumber: orderId,
      buyerName: user?.profile?.fullName || method.cardHolder || 'Cliente',
      buyerEmail: user?.email || '',
      buyerPhone: user?.profile?.phone || undefined,
      buyerAddress: order.shippingAddress,
      buyerCity: order.shippingCity,
    });

    if (result.status === 'approved') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'paid', paymentReference: result.epaycoRef },
      });
    } else if (result.status === 'rejected') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });
    }

    return NextResponse.json({
      status: result.status,
      epaycoRef: result.epaycoRef,
      message: result.message,
    });
  } catch (err: any) {
    if (err instanceof EpaycoError) return NextResponse.json({ message: err.message }, { status: 400 });
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
