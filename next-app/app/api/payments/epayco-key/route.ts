import { NextResponse } from 'next/server';

export async function GET() {
  const publicKey = process.env.EPAYCO_PUBLIC_KEY;

  if (!publicKey) {
    return NextResponse.json(
      { message: 'ePayco public key not configured' },
      { status: 500 },
    );
  }

  return NextResponse.json({ publicKey });
}
