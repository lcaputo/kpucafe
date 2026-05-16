// app/api/orders/[id]/test-event/route.ts
// DEV-ONLY endpoint to manually fire an SSE event for a given order.
// Remove or disable in production if needed.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { emitOrderUpdate } from '@/lib/order-events';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ message: 'Not available in production' }, { status: 404 });
  }

  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const payload = {
      status: body.status,
      muStatus: body.muStatus ?? 'delivering',
      muDriverName: body.muDriverName ?? 'Mensajero de prueba',
      muDriverPhone: body.muDriverPhone ?? '3001234567',
      muDriverPlate: body.muDriverPlate ?? 'ABC123',
      muTrackingUrl: body.muTrackingUrl ?? null,
      deliveryMethod: body.deliveryMethod ?? 'mensajeros_urbanos',
    };

    emitOrderUpdate(id, payload);
    return NextResponse.json({ message: 'Event emitted', orderId: id, payload });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
