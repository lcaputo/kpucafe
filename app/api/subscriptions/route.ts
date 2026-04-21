import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { computeNextBillingDate } from '@/lib/billing';
import { log } from '@/lib/logger';

export async function GET() {
  try {
    const session = await requireAuth();
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: session.id },
      include: {
        product: { select: { name: true, imageUrl: true } },
        variant: { select: { weight: true, grind: true } },
        plan: { select: { name: true, frequencyLabel: true } },
        paymentMethod: { select: { franchise: true, mask: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(subscriptions);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const {
      planId, productId, variantId,
      paymentMethodId,
      shippingAddress, shippingCity,
    } = await req.json();

    if (!planId || !productId || !paymentMethodId || !shippingAddress || !shippingCity) {
      return NextResponse.json({ message: 'Datos incompletos' }, { status: 400 });
    }

    // Verify payment method belongs to user
    const method = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId: session.id },
    });
    if (!method) return NextResponse.json({ message: 'Método de pago no válido' }, { status: 400 });

    // Get plan
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) return NextResponse.json({ message: 'Plan no disponible' }, { status: 400 });

    const price = plan.price;
    const frequency = plan.frequency as 'weekly' | 'biweekly' | 'monthly';
    const today = new Date();
    const nextDeliveryDate = computeNextBillingDate(today, frequency);

    const subscription = await prisma.subscription.create({
      data: {
        userId: session.id,
        productId,
        variantId: variantId || null,
        planId,
        planName: plan.name,
        paymentMethodId,
        frequency,
        status: 'active',
        price,
        shippingAddress,
        shippingCity,
        nextDeliveryDate,
      },
    });

    log({ level: 'info', type: 'subscription', action: 'subscription_created', message: 'Suscripción creada', userId: session.id, metadata: { subscriptionId: subscription.id, planId, price } });
    return NextResponse.json(subscription, { status: 201 });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
