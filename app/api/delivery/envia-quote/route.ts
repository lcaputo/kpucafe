import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enviaRate } from '@/lib/envia';
import { getEnviaConfig } from '@/lib/delivery-config';

export async function POST(req: Request) {
  try {
    const { city, department, postalCode, address, items } = await req.json();

    if (!city || !address) {
      return NextResponse.json({ message: 'city y address son requeridos' }, { status: 400 });
    }

    const enviaConfig = getEnviaConfig();
    if (!enviaConfig.enabled || !enviaConfig.apiToken) {
      return NextResponse.json({ available: false, reason: 'Envio nacional no disponible' });
    }

    const carriers: string[] = enviaConfig.carriers;

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
        const weight = product?.shippingWeight || enviaConfig.defaultWeight;
        const length = product?.shippingLength || enviaConfig.defaultLength;
        const width = product?.shippingWidth || enviaConfig.defaultWidth;
        const height = product?.shippingHeight || enviaConfig.defaultHeight;

        totalWeight += weight * qty;
        maxLength = Math.max(maxLength, length);
        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);
        totalValue += (item.unitPrice || 0) * qty;
      }
    } else {
      totalWeight = enviaConfig.defaultWeight;
      maxLength = enviaConfig.defaultLength;
      maxWidth = enviaConfig.defaultWidth;
      maxHeight = enviaConfig.defaultHeight;
    }

    const origin = {
      name: enviaConfig.pickupStoreName,
      phone: enviaConfig.pickupPhone,
      street: enviaConfig.pickupAddress,
      city: enviaConfig.pickupCity,
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
      enviaRate({ apiToken: enviaConfig.apiToken, carrier, origin, destination, packages: [pkg] })
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
