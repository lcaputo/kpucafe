import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

async function handleWebhook(data: Record<string, string>) {
  const refPayco = data.x_ref_payco || data.ref_payco;
  const orderId = data.x_extra1 || data.x_id_invoice;
  const codResponse = data.x_cod_response || data.x_cod_transaction_state;

  if (!orderId) {
    return NextResponse.json({ message: 'No order ID' }, { status: 400 });
  }

  // Verify signature if private key is configured
  const epaycoPrivateKey = process.env.EPAYCO_PRIVATE_KEY;

  if (epaycoPrivateKey) {
    const xSignature = data.x_signature;
    const xCustIdCliente = data.x_cust_id_cliente;
    const xAmount = data.x_amount;
    const xCurrency = data.x_currency_code;

    if (xSignature && xCustIdCliente && xAmount && xCurrency && refPayco) {
      const signatureString = `${xCustIdCliente}^${epaycoPrivateKey}^${refPayco}^${codResponse}^${xAmount}^${xCurrency}`;
      const expectedSignature = createHash('sha256')
        .update(signatureString)
        .digest('hex');

      if (xSignature !== expectedSignature) {
        console.error('Invalid ePayco signature');
        return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
      }
      console.log('ePayco signature verified successfully');
    } else {
      return NextResponse.json({ message: 'Missing signature fields' }, { status: 400 });
    }
  } else {
    console.warn('EPAYCO_PRIVATE_KEY not set - signature verification skipped');
  }

  if (!refPayco) {
    return NextResponse.json({ message: 'No payment reference' }, { status: 400 });
  }

  // Validate with ePayco API
  let validatedCodResponse: string | null = null;

  try {
    const res = await fetch(
      `https://secure.epayco.co/validation/v1/reference/${refPayco}`,
    );
    const validationData = await res.json();

    if (validationData.success && validationData.data) {
      validatedCodResponse = String(validationData.data.x_cod_response);
      const validatedAmount = validationData.data.x_amount;

      console.log(`Validated transaction: ${JSON.stringify(validationData.data)}`);

      // Verify amount matches order
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { total: true },
      });

      if (order && order.total !== Number(validatedAmount)) {
        console.error(`Amount mismatch: ${order.total} vs ${validatedAmount}`);
        return NextResponse.json({ message: 'Amount mismatch' }, { status: 400 });
      }
    } else {
      console.error(`ePayco validation failed: ${JSON.stringify(validationData)}`);
      return NextResponse.json({ message: 'Payment validation failed' }, { status: 400 });
    }
  } catch (e: any) {
    if (e instanceof Response) throw e;
    console.error('Error validating with ePayco:', e);
    return NextResponse.json({ message: 'Payment validation unavailable' }, { status: 502 });
  }

  // Use validated response code
  const trustedCodResponse = validatedCodResponse || codResponse;

  // Map ePayco response codes to order status
  let orderStatus: 'pending' | 'paid' | 'cancelled' = 'pending';

  switch (trustedCodResponse) {
    case '1': // Aceptada
      orderStatus = 'paid';
      break;
    case '2': // Rechazada
    case '4': // Fallida
      orderStatus = 'cancelled';
      break;
    case '3': // Pendiente
    default:
      orderStatus = 'pending';
      break;
  }

  // Update order status
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: orderStatus,
        paymentReference: refPayco,
      },
    });
  } catch (e) {
    console.error('Error updating order:', e);
    return NextResponse.json({ message: 'Failed to update order' }, { status: 500 });
  }

  console.log(`Order ${orderId} updated to status: ${orderStatus}`);

  return NextResponse.json({ success: true, status: orderStatus });
}

// ePayco sends webhooks as GET (confirmation page redirect) or POST (server notification)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const data: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      data[key] = value;
    });

    return handleWebhook(data);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let data: Record<string, string>;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      data = {};
      formData.forEach((value, key) => {
        data[key] = String(value);
      });
    } else {
      data = await req.json();
    }

    return handleWebhook(data);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
