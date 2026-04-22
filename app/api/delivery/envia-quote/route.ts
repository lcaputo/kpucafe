import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enviaRate } from '@/lib/envia';

export async function POST(req: Request) {
  try {
    const { city, department, postalCode, address, items } = await req.json();

    if (!city || !address) {
      return NextResponse.json({ message: 'city y address son requeridos' }, { status: 400 });
    }

    const settings = await prisma.deliverySettings.findFirst({
      where: { provider: 'envia', enabled: true },
    });
    if (!settings || !settings.enviaApiToken) {
      return NextResponse.json({ available: false, reason: 'Envio nacional no disponible' });
    }

    const carriers: string[] = (settings.enviaCarriers as string[]) || ['coordinadora', 'deprisa'];

    // Calculate package from cart items
    let totalWeight = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;
    let totalValue = 0;

    if (items?.length) {
      for (const item of items) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        const qty = item.quantity || 1;
        const weight = product?.shippingWeight || settings.defaultWeight || 0.5;
        const length = product?.shippingLength || settings.defaultLength || 20;
        const width = product?.shippingWidth || settings.defaultWidth || 15;
        const height = product?.shippingHeight || settings.defaultHeight || 10;

        totalWeight += weight * qty;
        maxLength = Math.max(maxLength, length);
        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);
        totalValue += (item.unitPrice || 0) * qty;
      }
    } else {
      totalWeight = settings.defaultWeight || 0.5;
      maxLength = settings.defaultLength || 20;
      maxWidth = settings.defaultWidth || 15;
      maxHeight = settings.defaultHeight || 10;
    }

    const origin = {
      name: settings.pickupStoreName || 'KPU Cafe',
      phone: settings.pickupPhone,
      street: settings.pickupAddress,
      city: settings.pickupCity,
      state: 'AT',
      country: 'CO',
      postalCode: '080001',
    };

    const destination = {
      name: '',
      phone: '',
      street: address,
      city,
      state: department || '',
      country: 'CO',
      postalCode: postalCode || '',
    };

    const pkg = {
      content: 'Cafe especializado KPU',
      weight: totalWeight,
      length: maxLength,
      width: maxWidth,
      height: maxHeight,
      declaredValue: totalValue,
    };

    // Quote all carriers in parallel
    const ratePromises = carriers.map((carrier) =>
      enviaRate({ apiToken: settings.enviaApiToken!, carrier, origin, destination, packages: [pkg] })
        .catch(() => null)
    );

    const rates = (await Promise.all(ratePromises)).filter((r): r is NonNullable<typeof r> => r !== null);

    if (rates.length === 0) {
      return NextResponse.json({ available: false, reason: 'No hay cotizaciones disponibles' });
    }

    // Pick cheapest
    rates.sort((a, b) => a.totalPrice - b.totalPrice);
    const cheapest = rates[0];

    return NextResponse.json({
      available: true,
      shippingCost: cheapest.totalPrice,
      carrier: cheapest.carrier,
      service: cheapest.service,
      deliveryEstimate: cheapest.deliveryEstimate,
    });
  } catch (err: any) {
    return NextResponse.json({ available: false, reason: 'No se pudo cotizar el envio' });
  }
}
