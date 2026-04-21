import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createCustomer, EpaycoError } from '@/lib/epayco';

// GET — list saved cards for current user
export async function GET() {
  try {
    const session = await requireAuth();
    const methods = await prisma.paymentMethod.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        franchise: true,
        mask: true,
        expMonth: true,
        expYear: true,
        cardHolder: true,
        isDefault: true,
        createdAt: true,
      },
    });
    return NextResponse.json(methods);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// POST — save a tokenized card (creates ePayco customer, stores in DB)
export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const { tokenId, franchise, mask, expMonth, expYear, cardHolder } = await req.json();
    if (!tokenId) return NextResponse.json({ message: 'tokenId requerido' }, { status: 400 });

    // Get profile for customer creation
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: { profile: true },
    });

    const { customerId } = await createCustomer({
      tokenId,
      name: user?.profile?.fullName || cardHolder || 'Cliente',
      email: user?.email || '',
      phone: user?.profile?.phone || undefined,
    });

    // Detect duplicate (same mask + franchise) → update token
    const existing = await prisma.paymentMethod.findFirst({
      where: { userId: session.id, mask, franchise },
    });

    let method;
    if (existing) {
      method = await prisma.paymentMethod.update({
        where: { id: existing.id },
        data: { tokenId, customerId, isDefault: true },
      });
    } else {
      // Mark all others as non-default
      await prisma.paymentMethod.updateMany({
        where: { userId: session.id },
        data: { isDefault: false },
      });
      method = await prisma.paymentMethod.create({
        data: {
          userId: session.id,
          tokenId,
          customerId,
          franchise: franchise || '',
          mask: mask || '',
          expMonth: expMonth || '',
          expYear: expYear || '',
          cardHolder: cardHolder || '',
          isDefault: true,
        },
      });
    }

    return NextResponse.json({
      id: method.id,
      franchise: method.franchise,
      mask: method.mask,
      expMonth: method.expMonth,
      expYear: method.expYear,
      isDefault: method.isDefault,
    });
  } catch (err: any) {
    if (err instanceof EpaycoError) return NextResponse.json({ message: err.message }, { status: 400 });
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
