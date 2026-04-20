import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await requireAuth();

    const orders = await prisma.order.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(orders);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const data = await req.json();

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: session.id,
          total: data.total,
          couponId: data.couponId,
          discountAmount: data.discountAmount ?? 0,
          shippingName: data.shippingName,
          shippingPhone: data.shippingPhone,
          shippingAddress: data.shippingAddress,
          shippingCity: data.shippingCity,
          shippingDepartment: data.shippingDepartment,
          shippingPostalCode: data.shippingPostalCode,
          notes: data.notes,
        },
      });

      if (data.items?.length) {
        await tx.orderItem.createMany({
          data: data.items.map((item: any) => ({
            orderId: created.id,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantInfo: item.variantInfo,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        });
      }

      // Increment coupon usage if a coupon was applied
      if (data.couponId) {
        await tx.coupon.update({
          where: { id: data.couponId },
          data: { currentUses: { increment: 1 } },
        });
      }

      return tx.order.findUnique({
        where: { id: created.id },
        include: { items: true },
      });
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
