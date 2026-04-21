import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { tokenizeCard, createCustomer, chargeCard, EpaycoError } from '@/lib/epayco';

// Tokenize + create customer + charge without saving to DB
export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const { cardNumber, expMonth, expYear, cvc, cardHolder, amount, orderId } = await req.json();

    // SECURITY: cardNumber y cvc son solo para tokenización — nunca registrar ni devolver en respuestas

    if (!cardNumber || !expMonth || !expYear || !cvc || !cardHolder || !amount || !orderId) {
      return NextResponse.json({ message: 'Datos incompletos' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: session.id },
    });
    if (!order) return NextResponse.json({ message: 'Pedido no encontrado' }, { status: 404 });

    if (order.status !== 'pending') {
      return NextResponse.json({ message: 'El pedido ya fue procesado' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: { profile: true },
    });
    if (!user) return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });

    const { tokenId, franchise, mask } = await tokenizeCard({ cardNumber, expMonth, expYear, cvc, cardHolder });
    const { customerId } = await createCustomer({
      tokenId,
      name: user.profile?.fullName || cardHolder,
      email: user.email,
      phone: user.profile?.phone || undefined,
    });

    const result = await chargeCard({
      tokenId,
      customerId,
      amount,
      description: `KPU Cafe - Pedido #${orderId.slice(0, 8)}`,
      invoiceNumber: orderId,
      buyerName: user.profile?.fullName || cardHolder,
      buyerEmail: user.email,
      buyerPhone: user.profile?.phone || undefined,
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
      franchise,
      mask,
      message: result.message,
    });
  } catch (err: any) {
    if (err instanceof EpaycoError) return NextResponse.json({ message: err.message }, { status: 400 });
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
