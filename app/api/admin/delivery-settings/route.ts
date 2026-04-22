import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { log } from '@/lib/logger';

export async function GET() {
  try {
    await requireAdmin();
    const settings = await prisma.deliverySettings.findMany();
    return NextResponse.json(settings);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAdmin();
    const data = await req.json();

    const settings = await prisma.deliverySettings.upsert({
      where: { city: data.city },
      update: {
        enabled: data.enabled,
        muAccessToken: data.muAccessToken,
        muWebhookToken: data.muWebhookToken,
        pickupAddress: data.pickupAddress,
        pickupCity: data.pickupCity,
        pickupStoreId: data.pickupStoreId,
        pickupStoreName: data.pickupStoreName,
        pickupPhone: data.pickupPhone,
        timeSlots: data.timeSlots,
        availableDays: data.availableDays,
      },
      create: {
        city: data.city,
        enabled: data.enabled ?? true,
        muAccessToken: data.muAccessToken,
        muWebhookToken: data.muWebhookToken,
        pickupAddress: data.pickupAddress,
        pickupCity: data.pickupCity,
        pickupStoreId: data.pickupStoreId,
        pickupStoreName: data.pickupStoreName,
        pickupPhone: data.pickupPhone,
        timeSlots: data.timeSlots ?? [],
        availableDays: data.availableDays ?? 7,
      },
    });

    log({ level: 'info', type: 'admin', action: 'update_delivery_settings', message: `Delivery settings updated for ${data.city}`, userId: session.id });
    return NextResponse.json(settings);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
