import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { chargeCard, EpaycoError } from '@/lib/epayco';
import { computeNextBillingDate } from '@/lib/billing';
import { log } from '@/lib/logger';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        paymentMethod: true,
        product: { select: { name: true } },
        variant: { select: { weight: true, grind: true } },
        user: { include: { profile: true } },
      },
    });
    if (!sub) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });
    if (!sub.paymentMethod) return NextResponse.json({ message: 'Sin método de pago' }, { status: 400 });

    const order = await prisma.order.create({
      data: {
        userId: sub.userId,
        status: 'pending',
        total: sub.price,
        shippingName: sub.user.profile?.fullName || 'Cliente',
        shippingPhone: sub.user.profile?.phone || '',
        shippingAddress: sub.shippingAddress,
        shippingCity: sub.shippingCity,
        items: {
          create: [{
            productName: sub.product?.name || sub.planName || 'Café KPU',
            variantInfo: sub.variant ? `${sub.variant.weight} - ${sub.variant.grind}` : '',
            quantity: 1,
            unitPrice: sub.price,
          }],
        },
      },
    });

    const result = await chargeCard({
      tokenId: sub.paymentMethod.tokenId,
      customerId: sub.paymentMethod.customerId,
      amount: sub.price,
      description: `KPU Cafe - ${sub.planName || 'Suscripción'} (reintento admin)`,
      invoiceNumber: order.id,
      buyerName: sub.user.profile?.fullName || 'Cliente',
      buyerEmail: sub.user.email,
    });

    await prisma.billingRecord.create({
      data: {
        subscriptionId: sub.id,
        orderId: order.id,
        paymentMethodId: sub.paymentMethodId!,
        amount: sub.price,
        status: result.status === 'approved' ? 'approved' : 'rejected',
        epaycoRef: result.epaycoRef,
        retryCount: 0,
      },
    });
    log({ level: 'info', type: 'admin', action: 'admin_charge_retry', message: `Reintento de cobro admin: ${result.status}`, metadata: { subscriptionId: id, status: result.status, epaycoRef: result.epaycoRef } });

    if (result.status === 'approved') {
      const nextDate = computeNextBillingDate(
        sub.nextDeliveryDate,
        sub.frequency as 'weekly' | 'biweekly' | 'monthly',
      );
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'active', nextDeliveryDate: nextDate },
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'paid', paymentReference: result.epaycoRef },
      });
    } else {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
    }

    return NextResponse.json({ status: result.status, epaycoRef: result.epaycoRef });
  } catch (err: any) {
    if (err instanceof EpaycoError) return NextResponse.json({ message: err.message }, { status: 400 });
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
