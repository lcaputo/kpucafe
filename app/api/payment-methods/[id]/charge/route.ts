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
    const { amount, orderId, subscriptionId } = await req.json();

    if (!amount || (!orderId && !subscriptionId)) {
      return NextResponse.json({ message: 'amount y (orderId o subscriptionId) requeridos' }, { status: 400 });
    }

    const method = await prisma.paymentMethod.findFirst({
      where: { id, userId: session.id },
    });
    if (!method) return NextResponse.json({ message: 'Método de pago no encontrado' }, { status: 404 });

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: { profile: true },
    });

    let targetOrderId = orderId as string | undefined;

    if (!orderId && subscriptionId) {
      const sub = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { product: true, variant: true },
      });
      if (!sub) return NextResponse.json({ message: 'Suscripción no encontrada' }, { status: 404 });

      const newOrder = await prisma.order.create({
        data: {
          userId: session.id,
          status: 'pending',
          total: amount,
          shippingName: user?.profile?.fullName || 'Cliente',
          shippingPhone: user?.profile?.phone || '',
          shippingAddress: sub.shippingAddress,
          shippingCity: sub.shippingCity,
          items: {
            create: [{
              productName: sub.product?.name || sub.planName || 'Café KPU',
              variantInfo: sub.variant ? `${sub.variant.weight} - ${sub.variant.grind}` : '',
              quantity: 1,
              unitPrice: amount,
            }],
          },
        },
      });
      targetOrderId = newOrder.id;
    }

    const order = await prisma.order.findUnique({ where: { id: targetOrderId } });
    if (!order) return NextResponse.json({ message: 'Pedido no encontrado' }, { status: 404 });

    if (order.status !== 'pending') {
      return NextResponse.json({ message: 'El pedido ya fue procesado' }, { status: 400 });
    }

    const result = await chargeCard({
      tokenId: method.tokenId,
      customerId: method.customerId,
      amount,
      description: `KPU Cafe - Pedido #${targetOrderId!.slice(0, 8)}`,
      invoiceNumber: targetOrderId!,
      buyerName: user?.profile?.fullName || method.cardHolder || 'Cliente',
      buyerEmail: user?.email || '',
      buyerPhone: user?.profile?.phone || undefined,
      buyerAddress: order.shippingAddress,
      buyerCity: order.shippingCity,
    });

    if (result.status === 'approved') {
      await prisma.order.update({
        where: { id: targetOrderId },
        data: { status: 'paid', paymentReference: result.epaycoRef },
      });
    } else if (result.status === 'rejected') {
      await prisma.order.update({
        where: { id: targetOrderId },
        data: { status: 'cancelled' },
      });
    }

    // Create billing record when charging for a subscription
    if (subscriptionId) {
      await prisma.billingRecord.create({
        data: {
          subscriptionId,
          orderId: targetOrderId,
          paymentMethodId: id,
          amount,
          status: result.status as 'approved' | 'rejected' | 'pending' | 'failed',
          epaycoRef: result.epaycoRef || null,
          errorMessage: result.status !== 'approved' ? (result.message || null) : null,
        },
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
