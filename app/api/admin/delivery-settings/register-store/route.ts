import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { muAddStore } from '@/lib/mensajeros-urbanos';
import { log } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const { city } = await req.json();

    const settings = await prisma.deliverySettings.findFirst({ where: { city, provider: 'mensajeros_urbanos' } });
    if (!settings) return NextResponse.json({ message: 'Configuracion no encontrada para esta ciudad' }, { status: 404 });

    await muAddStore({
      accessToken: settings.muAccessToken,
      idPoint: settings.pickupStoreId,
      name: settings.pickupStoreName,
      address: settings.pickupAddress,
      city: settings.pickupCity,
      phone: settings.pickupPhone,
    });

    log({ level: 'info', type: 'delivery', action: 'register_mu_store', message: `MU store registered for ${city}`, userId: session.id });
    return NextResponse.json({ message: 'Punto de recogida registrado en Mensajeros Urbanos' });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
