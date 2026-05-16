// app/api/orders/[id]/subscribe/route.ts
// Server-Sent Events endpoint for real-time order status updates.
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { subscribeToOrder } from '@/lib/order-events';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, userId: session.id },
    select: { id: true },
  });
  if (!order) {
    return new Response('Not found', { status: 404 });
  }

  console.log(`[SSE] Client connected — order:${id}`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Initial ping so the browser marks the connection as open
      controller.enqueue(encoder.encode(': connected\n\n'));

      const unsubscribe = subscribeToOrder(id, (payload) => {
        try {
          console.log(`[SSE] Sending event to client — order:${id}`, payload);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // Controller already closed
        }
      });

      // Heartbeat every 25 s to keep the connection alive through proxies
      const heartbeatId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatId);
        }
      }, 25_000);

      req.signal.addEventListener('abort', () => {
        console.log(`[SSE] Client disconnected — order:${id}`);
        unsubscribe();
        clearInterval(heartbeatId);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // disable Nginx buffering
    },
  });
}
