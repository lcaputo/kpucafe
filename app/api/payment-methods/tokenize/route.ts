import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { tokenizeCard, EpaycoError } from '@/lib/epayco';

export async function POST(req: Request) {
  try {
    await requireAuth();
    const { cardNumber, expMonth, expYear, cvc, cardHolder } = await req.json();
    if (!cardNumber || !expMonth || !expYear || !cvc || !cardHolder) {
      return NextResponse.json({ message: 'Datos de tarjeta incompletos' }, { status: 400 });
    }
    const result = await tokenizeCard({ cardNumber, expMonth, expYear, cvc, cardHolder });
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof EpaycoError) {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
