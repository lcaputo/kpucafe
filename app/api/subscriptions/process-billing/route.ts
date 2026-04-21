import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chargeCard, EpaycoError } from '@/lib/epayco';
import { computeNextBillingDate } from '@/lib/billing';

export async function POST(req: Request) {
  // Verify secret
  const auth = req.headers.get('authorization') || '';
  const secret = process.env.BILLING_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999); // include everything up to end of today

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      nextDeliveryDate: { lte: today },
      paymentMethodId: { not: null },
    },
    include: {
      paymentMethod: true,
      product: { select: { name: true } },
      variant: { select: { weight: true, grind: true } },
      user: { include: { profile: true } },
    },
  });

  let approved = 0, failed = 0, paused = 0;

  for (const sub of subscriptions) {
    if (!sub.paymentMethod) continue;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const alreadyBilledToday = await prisma.billingRecord.findFirst({
      where: {
        subscriptionId: sub.id,
        createdAt: { gte: startOfToday },
        status: { in: ['approved', 'pending'] },
      },
    });
    if (alreadyBilledToday) continue;

    // Create order for this billing cycle
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

    // Get current retry count (consecutive failures)
    const recentRecords = await prisma.billingRecord.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    // Count consecutive failures from the most recent record
    let consecutiveFailures = 0;
    for (const rec of recentRecords) {
      if (rec.status === 'rejected' || rec.status === 'failed') consecutiveFailures++;
      else break;
    }
    const retryCount = consecutiveFailures;

    let chargeStatus: 'approved' | 'rejected' | 'failed' = 'failed';
    let epaycoRef: string | null = null;
    let errorMessage: string | null = null;

    try {
      const result = await chargeCard({
        tokenId: sub.paymentMethod.tokenId,
        customerId: sub.paymentMethod.customerId,
        amount: sub.price,
        description: `KPU Cafe - ${sub.planName || 'Suscripción'}`,
        invoiceNumber: order.id,
        buyerName: sub.user.profile?.fullName || 'Cliente',
        buyerEmail: sub.user.email,
        buyerPhone: sub.user.profile?.phone || undefined,
        buyerAddress: sub.shippingAddress,
        buyerCity: sub.shippingCity,
      });

      chargeStatus = result.status === 'approved' ? 'approved' : 'rejected';
      epaycoRef = result.epaycoRef;

      if (result.status === 'approved') {
        const nextDate = computeNextBillingDate(
          sub.nextDeliveryDate,
          sub.frequency as 'weekly' | 'biweekly' | 'monthly',
        );
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { nextDeliveryDate: nextDate },
        });
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'paid', paymentReference: epaycoRef },
        });
        approved++;
      } else {
        await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
        failed++;
        if (retryCount >= 2) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'paused' },
          });
          paused++;
        }
      }
    } catch (err: any) {
      chargeStatus = 'failed';
      errorMessage = err instanceof EpaycoError ? err.message : String(err.message);
      await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
      failed++;
      if (retryCount >= 2) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'paused' },
        });
        paused++;
      }
    }

    await prisma.billingRecord.create({
      data: {
        subscriptionId: sub.id,
        orderId: order.id,
        paymentMethodId: sub.paymentMethodId!,
        amount: sub.price,
        status: chargeStatus,
        epaycoRef,
        errorMessage,
        retryCount,
      },
    });
  }

  return NextResponse.json({
    processed: subscriptions.length,
    approved,
    failed,
    paused,
  });
}
