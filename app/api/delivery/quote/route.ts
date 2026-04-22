import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { muCalculate, MU_CITY_IDS } from '@/lib/mensajeros-urbanos';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city');
    const address = searchParams.get('address');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!city || !address) {
      return NextResponse.json({ message: 'city y address son requeridos' }, { status: 400 });
    }

    if (!lat || !lng) {
      return NextResponse.json({ message: 'lat y lng son requeridos' }, { status: 400 });
    }

    const cityId = MU_CITY_IDS[city as keyof typeof MU_CITY_IDS];
    if (!cityId) {
      return NextResponse.json({ available: false, reason: 'Ciudad no disponible para delivery express' });
    }

    const settings = await prisma.deliverySettings.findUnique({ where: { city } });
    if (!settings || !settings.enabled) {
      return NextResponse.json({ available: false, reason: 'Delivery express no disponible en esta ciudad' });
    }

    // Parse destination coordinates
    const destLat = parseFloat(lat);
    const destLng = parseFloat(lng);

    if (isNaN(destLat) || isNaN(destLng)) {
      return NextResponse.json({ message: 'Coordenadas invalidas' }, { status: 400 });
    }

    // Default coordinates for pickup locations (should ideally be stored in DeliverySettings)
    // For now, using Barranquilla coordinates as a placeholder
    const pickupCoords = {
      Barranquilla: { lat: 10.9639, lng: -74.7964 },
      Bogota: { lat: 4.7110, lng: -74.0055 },
      Cali: { lat: 3.4372, lng: -76.5197 },
      Medellin: { lat: 6.2443, lng: -75.5812 },
      Cartagena: { lat: 10.3910, lng: -75.4794 },
    } as const;

    const originCoords = pickupCoords[city as keyof typeof pickupCoords];
    if (!originCoords) {
      return NextResponse.json({ available: false, reason: 'No se pudo determinar ubicacion de recogida' });
    }

    const quote = await muCalculate({
      accessToken: settings.muAccessToken,
      city: cityId,
      declaredValue: 0,
      origin: originCoords,
      destination: { lat: destLat, lng: destLng },
    });

    return NextResponse.json({
      available: true,
      shippingCost: quote.totalService,
      distance: quote.totalDistance,
      timeSlots: settings.timeSlots,
      availableDays: settings.availableDays,
    });
  } catch (err: any) {
    return NextResponse.json({ available: false, reason: 'No se pudo cotizar el envio express' });
  }
}
