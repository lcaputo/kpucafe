import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';
import { triggerMuDeliveryIfNeeded, triggerEnviaDeliveryIfNeeded } from '@/lib/delivery';

/**
 * ePayco confirmation webhook.
 *
 * ePayco POSTs query-string params after a transaction completes.
 * Signature formula: sha256(p_cust_id_cliente ^ p_key ^ x_ref_payco ^ x_transaction_id ^ x_amount ^ x_currency_code)
 *
 * Required env vars: EPAYCO_P_CUST_ID_CLIENTE, EPAYCO_P_KEY
 */

const EPAYCO_STATE_MAP: Record<string, 'approved' | 'rejected' | 'pending' | 'failed'> = {
  Aceptada: 'approved',
  Rechazada: 'rejected',
  Pendiente: 'pending',
  Fallida: 'failed',
  Abandonada: 'failed',
  Cancelada: 'failed',
  Expirada: 'failed',
};

function verifySignature(
  ref: string,
  transactionId: string,
  amount: string,
  currency: string,
  receivedSig: string,
): boolean {
  const custId = process.env.EPAYCO_P_CUST_ID_CLIENTE || '';
  const pKey = process.env.EPAYCO_P_KEY || '';

  // Try with raw amount
  const raw = `${custId}^${pKey}^${ref}^${transactionId}^${amount}^${currency}`;
  const expected = createHash('sha256').update(raw).digest('hex');
  if (expected === receivedSig) return true;

  // ePayco sometimes sends amount as decimal (30000.00)
  const amountDec = amount.includes('.') ? amount : `${parseFloat(amount).toFixed(2)}`;
  const rawDec = `${custId}^${pKey}^${ref}^${transactionId}^${amountDec}^${currency}`;
  const expectedDec = createHash('sha256').update(rawDec).digest('hex');
  return expectedDec === receivedSig;
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const x_ref_payco = searchParams.get('x_ref_payco') || '';
    const x_transaction_state = searchParams.get('x_transaction_state') || '';
    const x_transaction_id = searchParams.get('x_transaction_id') || '';
    const x_amount = searchParams.get('x_amount') || '';
    const x_currency_code = searchParams.get('x_currency_code') || 'COP';
    const x_signature = searchParams.get('x_signature') || '';
    const x_id_invoice = searchParams.get('x_id_invoice') || searchParams.get('x_id_factura') || '';
    const x_test_request = searchParams.get('x_test_request') || '';

    const allParams = Object.fromEntries(searchParams.entries());

    log({
      level: 'info',
      type: 'payment',
      action: 'epayco_webhook_received',
      message: `ePayco webhook: ref=${x_ref_payco} state=${x_transaction_state} amount=${x_amount}`,
      metadata: allParams,
    });

    // Reject test requests in production
    if (x_test_request.toUpperCase() === 'TRUE' && process.env.NODE_ENV === 'production') {
      log({ level: 'warn', type: 'payment', action: 'epayco_webhook_test_rejected', message: `Test webhook rejected ref=${x_ref_payco}` });
      return NextResponse.json({ message: 'Test requests not allowed' }, { status: 400 });
    }

    // Verify signature
    if (!verifySignature(x_ref_payco, x_transaction_id, x_amount, x_currency_code, x_signature)) {
      log({
        level: 'warn',
        type: 'payment',
        action: 'epayco_webhook_invalid_signature',
        message: `Invalid signature for ref=${x_ref_payco}`,
        metadata: { x_ref_payco, x_transaction_id, x_amount, x_currency_code },
      });
      return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
    }

    // Map ePayco state to internal status
    const internalStatus = EPAYCO_STATE_MAP[x_transaction_state] || 'failed';

    // Find order by paymentReference (ref_payco) or by id (x_id_invoice = orderId)
    let order = await prisma.order.findFirst({ where: { paymentReference: x_ref_payco } });

    if (!order && x_id_invoice) {
      order = await prisma.order.findUnique({ where: { id: x_id_invoice } });
    }

    if (!order) {
      log({
        level: 'warn',
        type: 'payment',
        action: 'epayco_webhook_order_not_found',
        message: `No order found for ref=${x_ref_payco} invoice=${x_id_invoice}`,
      });
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // Skip if order is already in a final state
    if (order.status === 'delivered' || order.status === 'shipped') {
      log({
        level: 'info',
        type: 'payment',
        action: 'epayco_webhook_skipped',
        message: `Order ${order.id} already in ${order.status}, skipping`,
      });
      return NextResponse.json({ status: 'ok', payment_status: internalStatus });
    }

    // Update order based on payment status
    if (internalStatus === 'approved' && order.status === 'pending') {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'paid', paymentReference: x_ref_payco },
      });

      log({
        level: 'info',
        type: 'payment',
        action: 'epayco_webhook_approved',
        message: `Payment approved for order ${order.id} ref=${x_ref_payco}`,
        userId: order.userId || undefined,
        metadata: { orderId: order.id, amount: x_amount, ref_payco: x_ref_payco },
      });

      // Trigger delivery
      triggerMuDeliveryIfNeeded(order.id).catch(() => {});
      triggerEnviaDeliveryIfNeeded(order.id).catch(() => {});

    } else if (internalStatus === 'rejected' || internalStatus === 'failed') {
      if (order.status === 'pending') {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'cancelled', paymentReference: x_ref_payco },
        });
      }

      log({
        level: 'warn',
        type: 'payment',
        action: 'epayco_webhook_rejected',
        message: `Payment ${internalStatus} for order ${order.id} ref=${x_ref_payco}`,
        userId: order.userId || undefined,
        metadata: { orderId: order.id, amount: x_amount, state: x_transaction_state },
      });

    } else if (internalStatus === 'pending') {
      // Update ref but keep order pending
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentReference: x_ref_payco },
      });

      log({
        level: 'info',
        type: 'payment',
        action: 'epayco_webhook_pending',
        message: `Payment pending for order ${order.id} ref=${x_ref_payco}`,
      });
    }

    return NextResponse.json({ status: 'ok', payment_status: internalStatus });
  } catch (err: any) {
    log({
      level: 'error',
      type: 'payment',
      action: 'epayco_webhook_error',
      message: err.message,
      error: err.stack,
    });
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}

// ePayco may also send GET requests for confirmation
export { POST as GET };
