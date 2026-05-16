import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin, signAccessToken } from '@/lib/auth';
import { triggerMuDeliveryIfNeeded } from '@/lib/delivery';
import { log } from '@/lib/logger';
import { sendDomicilioCreatedEmail } from '@/lib/emails/delivery-notifications';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const url = req.nextUrl;
    const status = url.searchParams.get('status');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    if ((fromDate && isNaN(fromDate.getTime())) || (toDate && isNaN(toDate.getTime()))) {
      return NextResponse.json({ message: 'Formato de fecha invalido' }, { status: 400 });
    }

    const where: Prisma.OrderWhereInput = {
      source: 'whatsapp',
      deliveryMethod: 'mensajeros_urbanos',
    };

    if (status) {
      where.status = status as Prisma.EnumOrderStatusFilter;
    }
    if (fromDate || toDate) {
      where.scheduledDate = {};
      if (fromDate) (where.scheduledDate as Prisma.DateTimeNullableFilter).gte = fromDate;
      if (toDate) (where.scheduledDate as Prisma.DateTimeNullableFilter).lte = toDate;
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true, user: { include: { profile: true } } },
      orderBy: { scheduledDate: 'asc' },
    });

    return NextResponse.json(orders);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();

    const {
      customer,
      address,
      items,
      paymentMethod,
      dispatch,
      notes,
    } = body;

    if (!customer?.email || !customer?.fullName || !address?.city || !Array.isArray(items) || items.length === 0 || !dispatch?.type) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 });
    }

    // 1. Resolve or create user
    let userId: string;

    if (customer.id) {
      userId = customer.id;
      await prisma.profile.updateMany({
        where: { userId: customer.id },
        data: {
          phone: customer.phone,
          address: address.address,
          city: address.city,
          department: address.department || null,
        },
      });
    } else {
      const existing = await prisma.user.findUnique({ where: { email: customer.email } });
      if (existing) {
        userId = existing.id;
        await prisma.profile.updateMany({
          where: { userId: existing.id },
          data: {
            phone: customer.phone,
            address: address.address,
            city: address.city,
            department: address.department || null,
          },
        });
      } else {
        const newUser = await prisma.user.create({
          data: {
            email: customer.email,
            passwordHash: '',
            registrationComplete: false,
            profile: {
              create: {
                fullName: customer.fullName,
                phone: customer.phone,
                address: address.address,
                city: address.city,
                department: address.department || null,
              },
            },
            roles: {
              create: { role: 'user' },
            },
          },
        });
        userId = newUser.id;
      }
    }

    // 2. Calculate total
    const total = items.reduce((sum: number, item: any) => sum + item.unitPrice * item.quantity, 0);

    // 3. Determine scheduled date
    let scheduledDate: Date | null = null;
    if (dispatch.type === 'scheduled' && dispatch.date && dispatch.timeSlot) {
      scheduledDate = new Date(`${dispatch.date}T${dispatch.timeSlot}:00-05:00`);
    }

    // 4. Create order
    const order = await prisma.order.create({
      data: {
        userId,
        status: 'paid',
        source: 'whatsapp',
        total,
        shippingName: customer.fullName,
        shippingPhone: customer.phone,
        shippingAddress: address.address,
        shippingCity: address.city,
        shippingDepartment: address.department || null,
        deliveryMethod: 'mensajeros_urbanos',
        scheduledDate,
        notes: [notes, `Pago: ${paymentMethod}`].filter(Boolean).join(' | '),
        items: {
          create: items.map((item: any) => ({
            productId: item.productId || null,
            variantId: item.variantId || null,
            productName: item.productName,
            variantInfo: item.variantInfo || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    log({
      level: 'info',
      type: 'delivery',
      action: 'domicilio_created',
      message: `Domicilio created: ${order.id}`,
      userId: session.id,
      metadata: { orderId: order.id, dispatchType: dispatch.type },
    });

    // 5. If immediate, trigger MU
    if (dispatch.type === 'immediate') {
      await triggerMuDeliveryIfNeeded(order.id);
    }

    // 6. Send creation email (async, non-blocking)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const registrationToken = !user.registrationComplete
        ? await signAccessToken({ sub: user.id, email: user.email })
        : undefined;
      sendDomicilioCreatedEmail({
        to: user.email,
        orderId: order.id,
        customerName: customer.fullName,
        items,
        total,
        scheduledDate: scheduledDate
          ? scheduledDate.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
          : 'Inmediato',
        registrationComplete: user.registrationComplete,
        registrationToken,
      }).catch(() => {});
    }

    return NextResponse.json(order, { status: 201 });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
