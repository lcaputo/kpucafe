import { EventEmitter } from 'events';

// In-memory pub/sub for real-time order updates.
//
// IMPORTANT: stored on `global` to survive Next.js module re-evaluations in
// dev (HMR) and to guarantee a single shared EventEmitter instance across all
// Route Handlers running in the same Node.js process.
//
// For multi-instance deployments replace with Redis Pub/Sub.

declare global {
  // eslint-disable-next-line no-var
  var __orderEmitter: EventEmitter | undefined;
}

if (!global.__orderEmitter) {
  global.__orderEmitter = new EventEmitter();
  global.__orderEmitter.setMaxListeners(500);
}

const emitter = global.__orderEmitter;

export interface OrderUpdatePayload {
  status?: string;
  deliveryMethod?: string | null;
  muStatus?: string | null;
  muDriverName?: string | null;
  muDriverPhone?: string | null;
  muDriverPlate?: string | null;
  muTrackingUrl?: string | null;
  muEta?: string | null;
  scheduledDate?: string | null;
  enviaCarrier?: string | null;
  enviaDeliveryEstimate?: string | null;
  enviaLabelUrl?: string | null;
}

export function emitOrderUpdate(orderId: string, payload: OrderUpdatePayload): void {
  const listenerCount = emitter.listenerCount(`order:${orderId}`);
  console.log(`[order-events] emit order:${orderId} — ${listenerCount} listener(s)`, payload);
  emitter.emit(`order:${orderId}`, payload);
}

export function subscribeToOrder(
  orderId: string,
  handler: (payload: OrderUpdatePayload) => void,
): () => void {
  emitter.on(`order:${orderId}`, handler);
  console.log(`[order-events] subscribed order:${orderId} — total listeners: ${emitter.listenerCount(`order:${orderId}`)}`);
  return () => {
    emitter.off(`order:${orderId}`, handler);
    console.log(`[order-events] unsubscribed order:${orderId}`);
  };
}
