import { NextResponse } from 'next/server';
import { getMuConfig } from '@/lib/delivery-config';
import { muCalculate, MU_CITY_IDS } from '@/lib/mensajeros-urbanos';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city');
    const address = searchParams.get('address');

    if (!city || !address) {
      return NextResponse.json({ message: 'city y address son requeridos' }, { status: 400 });
    }

    const cityId = MU_CITY_IDS[city];
    if (!cityId) {
      return NextResponse.json({ available: false, reason: 'Ciudad no disponible para delivery express' });
    }

    const muConfig = getMuConfig();
    if (!muConfig.enabled) {
      return NextResponse.json({ available: false, reason: 'Delivery express no disponible en esta ciudad' });
    }

    const quote = await muCalculate({
      accessToken: muConfig.accessToken,
      cityId,
      declaredValue: 0,
      originAddress: muConfig.pickupAddress,
      destinationAddress: address,
    });

    return NextResponse.json({
      available: true,
      shippingCost: quote.totalService,
      distance: quote.totalDistance,
      timeSlots: muConfig.timeSlots,
      availableDays: muConfig.availableDays,
    });
  } catch (err: any) {
    return NextResponse.json({ available: false, reason: 'No se pudo cotizar el envio express' });
  }
}
