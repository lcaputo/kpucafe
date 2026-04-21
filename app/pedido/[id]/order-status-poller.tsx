// app/pedido/[id]/order-status-poller.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, Clock, Home, Package, FileText } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { printInvoice, type InvoiceOrder } from '@/lib/invoice';

type OrderStatus = 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

interface OrderStatusPollerProps {
  orderId: string;
  initialStatus: OrderStatus;
  order: InvoiceOrder;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Procesando pago...',   color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  paid:      { label: 'Pago aprobado',         color: 'text-green-500',  bg: 'bg-green-500/10'  },
  preparing: { label: 'Preparando pedido',     color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
  shipped:   { label: 'Pedido enviado',        color: 'text-primary',    bg: 'bg-primary/10'    },
  delivered: { label: 'Pedido entregado',      color: 'text-green-600',  bg: 'bg-green-600/10'  },
  cancelled: { label: 'Pedido cancelado',      color: 'text-red-500',    bg: 'bg-red-500/10'    },
};

export default function OrderStatusPoller({ orderId, initialStatus, order }: OrderStatusPollerProps) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [timedOut, setTimedOut] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();
  const attemptRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (initialStatus !== 'pending') return;

    const poll = async () => {
      attemptRef.current++;
      if (attemptRef.current > 20) {
        stopPolling();
        setTimedOut(true);
        return;
      }
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== 'pending') {
          setStatus(data.status as OrderStatus);
          stopPolling();
        }
      } catch {
        // continue polling on transient errors
      }
    };

    intervalRef.current = setInterval(poll, 3000);
    return stopPolling;
  }, [orderId, initialStatus, stopPolling]);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      printInvoice(order);
    } catch {
      toast({ title: 'Error al generar factura', description: 'Intenta de nuevo', variant: 'destructive' });
    } finally {
      setIsPrinting(false);
    }
  };

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const isPaid = ['paid', 'preparing', 'shipped', 'delivered'].includes(status);
  const isCancelled = status === 'cancelled';
  const isPolling = status === 'pending' && !timedOut;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Status badge */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${cfg.color} ${cfg.bg}`}>
        {isPolling  && <Loader2     className="h-4 w-4 animate-spin" />}
        {isPaid     && <CheckCircle className="h-4 w-4" />}
        {isCancelled && <XCircle    className="h-4 w-4" />}
        {!isPolling && !isPaid && !isCancelled && <Clock className="h-4 w-4" />}
        {cfg.label}
      </div>

      {isPolling && (
        <p className="text-sm text-muted-foreground text-center">
          Esperando confirmacion del pago...
        </p>
      )}

      {timedOut && (
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          El pago esta siendo verificado. Revisa tu correo o consulta tus pedidos.
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <Link href="/" className="btn-kpu-outline flex items-center justify-center gap-2">
          <Home className="h-4 w-4" />
          Volver al inicio
        </Link>

        {isPaid && (
          <>
            <Link href="/mis-pedidos" className="btn-kpu flex items-center justify-center gap-2">
              <Package className="h-4 w-4" />
              Mis pedidos
            </Link>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="btn-kpu-outline flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {isPrinting ? 'Generando...' : 'Descargar factura'}
            </button>
          </>
        )}

        {isCancelled && (
          <Link href="/checkout" className="btn-kpu flex items-center justify-center gap-2">
            Intentar de nuevo
          </Link>
        )}
      </div>
    </div>
  );
}
