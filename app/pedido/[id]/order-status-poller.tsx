// app/pedido/[id]/order-status-poller.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, Clock, FileText, Truck, ExternalLink, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { printInvoice, type InvoiceOrder } from '@/lib/invoice';

type OrderStatus = 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

interface MUOrderData {
  deliveryMethod?: string | null;
  muStatus?: string | null;
  muDriverName?: string | null;
  muDriverPhone?: string | null;
  muDriverPlate?: string | null;
  muTrackingUrl?: string | null;
  muEta?: string | null;
  scheduledDate?: string | null;
  enviaCarrier?: string;
  enviaDeliveryEstimate?: string;
  enviaLabelUrl?: string;
}

interface OrderStatusPollerProps {
  orderId: string;
  initialStatus: OrderStatus;
  order: InvoiceOrder;
  muData?: MUOrderData;
}

const MU_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  on_hold:           { label: 'Buscando mensajero...',       color: 'text-yellow-600' },
  assigned:          { label: 'Mensajero asignado',          color: 'text-blue-600'   },
  picking_up:        { label: 'Recogiendo tu pedido',        color: 'text-orange-600' },
  delivering:        { label: 'En camino',                   color: 'text-primary'    },
  finished:          { label: 'Entregado',                   color: 'text-green-600'  },
  failed_delivery:   { label: 'Entrega fallida',             color: 'text-red-600'    },
  cancelled:         { label: 'Envío cancelado',             color: 'text-red-600'    },
  error:             { label: 'Error en envío',              color: 'text-red-600'    },
  create:            { label: 'Envío programado',            color: 'text-blue-600'   },
  // Envia statuses
  label_generated:   { label: 'Guía generada',               color: 'text-blue-600'   },
  picked_up:         { label: 'Recogido por transportadora', color: 'text-blue-600'   },
  in_transit:        { label: 'En tránsito',                 color: 'text-primary'    },
  out_for_delivery:  { label: 'En reparto',                  color: 'text-orange-600' },
  exception:         { label: 'Problema con envío',          color: 'text-red-600'    },
  returned:          { label: 'Devuelto',                    color: 'text-red-600'    },
};

const MU_TERMINAL_STATUSES = ['finished', 'failed_delivery', 'cancelled'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Procesando pago...',   color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  paid:      { label: 'Pago aprobado',         color: 'text-green-500',  bg: 'bg-green-500/10'  },
  preparing: { label: 'Preparando pedido',     color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
  shipped:   { label: 'Pedido enviado',        color: 'text-primary',    bg: 'bg-primary/10'    },
  delivered: { label: 'Pedido entregado',      color: 'text-green-600',  bg: 'bg-green-600/10'  },
  cancelled: { label: 'Pedido cancelado',      color: 'text-red-500',    bg: 'bg-red-500/10'    },
};

export default function OrderStatusPoller({ orderId, initialStatus, order, muData: initialMuData }: OrderStatusPollerProps) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [muOrder, setMuOrder] = useState<MUOrderData>(initialMuData ?? {});
  const [timedOut, setTimedOut] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  // ── Polling fallback (for pending payment) ─────────────────────────────────
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
      } catch { /* continue */ }
    };

    intervalRef.current = setInterval(poll, 3000);
    return stopPolling;
  }, [orderId, initialStatus, stopPolling]);

  // ── SSE: real-time updates ─────────────────────────────────────────────────
  useEffect(() => {
    // Don't subscribe if already in a terminal state with no active delivery
    const isMuOrder = ['mensajeros_urbanos', 'envia'].includes(initialMuData?.deliveryMethod || '');
    const muTerminal = isMuOrder && initialMuData?.muStatus
      ? MU_TERMINAL_STATUSES.includes(initialMuData.muStatus)
      : true;

    const isTerminalOrder =
      (initialStatus === 'delivered' || initialStatus === 'cancelled') && muTerminal;
    if (isTerminalOrder) return;

    const es = new EventSource(`/api/orders/${orderId}/subscribe`);

    es.onopen = () => setIsConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Partial<MUOrderData & { status: string }>;

        if (data.status) {
          setStatus(data.status as OrderStatus);
          // Stop polling fallback once payment resolves
          if (data.status !== 'pending') stopPolling();
        }

        // Merge any delivery fields that arrived
        const deliveryKeys: (keyof MUOrderData)[] = [
          'deliveryMethod', 'muStatus', 'muDriverName', 'muDriverPhone',
          'muDriverPlate', 'muTrackingUrl', 'muEta', 'scheduledDate',
          'enviaCarrier', 'enviaDeliveryEstimate', 'enviaLabelUrl',
        ];
        const hasDeliveryUpdate = deliveryKeys.some((k) => k in data);
        if (hasDeliveryUpdate) {
          setMuOrder((prev) => ({ ...prev, ...data }));
        }
      } catch { /* malformed message — ignore */ }
    };

    es.onerror = () => {
      setIsConnected(false);
      // EventSource auto-reconnects; no manual action needed
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [orderId, initialStatus, initialMuData, stopPolling]);

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
    <div className="flex flex-col gap-4">
      {/* Section label + connection indicator */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Estado
        </p>
        {isConnected ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
            <Wifi className="h-3 w-3" />
            En vivo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            Reconectando...
          </span>
        )}
      </div>

      {/* Status badge */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold self-start ${cfg.color} ${cfg.bg}`}>
        {isPolling   && <Loader2     className="h-4 w-4 animate-spin" />}
        {isPaid      && <CheckCircle className="h-4 w-4" />}
        {isCancelled && <XCircle     className="h-4 w-4" />}
        {!isPolling && !isPaid && !isCancelled && <Clock className="h-4 w-4" />}
        {cfg.label}
      </div>

      {isPolling && (
        <p className="text-sm text-muted-foreground -mt-2">
          Esperando confirmación del pago...
        </p>
      )}

      {timedOut && (
        <p className="text-sm text-muted-foreground -mt-2">
          El pago está siendo verificado. Revisa tu correo o consulta tus pedidos.
        </p>
      )}

      {/* Action buttons */}
      {isPaid && (
        <button
          onClick={handlePrint}
          disabled={isPrinting}
          className="btn-kpu-outline inline-flex items-center justify-center gap-2 disabled:opacity-50 self-start"
        >
          <FileText className="h-4 w-4" />
          {isPrinting ? 'Generando...' : 'Descargar factura'}
        </button>
      )}

      {/* MU / Envia Delivery Tracking */}
      {['mensajeros_urbanos', 'envia'].includes(muOrder.deliveryMethod || '') && muOrder.muStatus && (
        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground text-sm">
                {muOrder.deliveryMethod === 'envia'
                  ? `Envío nacional — ${muOrder.enviaCarrier || 'Coordinadora'}`
                  : 'Mensajeros Urbanos'}
              </span>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-background ${MU_STATUS_CONFIG[muOrder.muStatus]?.color || 'text-muted-foreground'}`}>
              {MU_STATUS_CONFIG[muOrder.muStatus]?.label || muOrder.muStatus}
            </span>
          </div>

          {/* Envia delivery estimate */}
          {muOrder.deliveryMethod === 'envia' && muOrder.enviaDeliveryEstimate && (
            <p className="text-sm text-muted-foreground">
              Entrega estimada: {muOrder.enviaDeliveryEstimate}
            </p>
          )}

          {/* Driver info */}
          {muOrder.muDriverName && (
            <div className="bg-background rounded-lg p-3 space-y-1.5">
              <p className="text-sm"><span className="text-muted-foreground">Mensajero:</span> <span className="font-medium">{muOrder.muDriverName}</span></p>
              {muOrder.muDriverPhone && (
                <p className="text-sm"><span className="text-muted-foreground">Teléfono:</span> <a href={`tel:${muOrder.muDriverPhone}`} className="font-medium text-primary hover:underline">{muOrder.muDriverPhone}</a></p>
              )}
              {muOrder.muDriverPlate && (
                <p className="text-sm"><span className="text-muted-foreground">Placa:</span> <span className="font-medium">{muOrder.muDriverPlate}</span></p>
              )}
              {muOrder.muEta && (
                <p className="text-sm"><span className="text-muted-foreground">ETA:</span> <span className="font-medium">{muOrder.muEta}</span></p>
              )}
            </div>
          )}

          {/* Scheduled date */}
          {muOrder.scheduledDate && ['create', 'on_hold'].includes(muOrder.muStatus) && (
            <p className="text-sm text-muted-foreground">
              Programado: {new Date(muOrder.scheduledDate).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          )}

          {/* Action links */}
          <div className="flex flex-wrap gap-2 pt-1">
            {muOrder.muTrackingUrl && (
              <a href={muOrder.muTrackingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                Ver en mapa
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {muOrder.deliveryMethod === 'envia' && muOrder.enviaLabelUrl && (
              <a href={muOrder.enviaLabelUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-primary text-primary rounded-lg text-xs font-medium hover:bg-primary/5 transition-colors">
                Descargar guía PDF
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
