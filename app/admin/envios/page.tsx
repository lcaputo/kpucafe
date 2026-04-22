'use client';

import { useState, useEffect } from 'react';
import { Truck, Package, Loader2, MapPin, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Order {
  id: string;
  status: string;
  total: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_department: string | null;
  tracking_number: string | null;
  created_at: string;
  delivery_method: string | null;
  mu_status: string | null;
  mu_driver_name: string | null;
  mu_driver_phone: string | null;
  mu_tracking_url: string | null;
  mu_eta: string | null;
  scheduled_date: string | null;
  envia_carrier: string | null;
  envia_label_url: string | null;
  envia_delivery_estimate: string | null;
}

const MU_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  on_hold:    { label: 'En espera',   className: 'bg-yellow-100 text-yellow-800' },
  create:     { label: 'En espera',   className: 'bg-yellow-100 text-yellow-800' },
  assigned:   { label: 'Asignado',    className: 'bg-blue-100 text-blue-800' },
  picking_up: { label: 'Recogiendo',  className: 'bg-orange-100 text-orange-800' },
  delivering: { label: 'En camino',   className: 'bg-primary/10 text-primary' },
  finished:   { label: 'Entregado',   className: 'bg-green-100 text-green-800' },
  error:      { label: 'Error',       className: 'bg-red-100 text-red-800' },
  failed:     { label: 'Fallido',     className: 'bg-red-100 text-red-800' },
  cancelled:  { label: 'Cancelado',   className: 'bg-red-100 text-red-800' },
};

export default function AdminShippingPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPendingShipments(); }, []);

  const fetchPendingShipments = async () => {
    try {
      const res = await fetch('/api/admin/orders');
      const data = await res.json();
      const shippingOrders = (data as any[])
        .filter((o: any) => ['paid', 'preparing', 'shipped'].includes(o.status) || o.deliveryMethod === 'mensajeros_urbanos')
        .map((o: any) => ({
          id: o.id,
          status: o.status,
          total: o.total,
          shipping_name: o.shippingName,
          shipping_phone: o.shippingPhone,
          shipping_address: o.shippingAddress,
          shipping_city: o.shippingCity,
          shipping_department: o.shippingDepartment,
          tracking_number: o.trackingNumber,
          created_at: o.createdAt,
          delivery_method: o.deliveryMethod,
          mu_status: o.muStatus,
          mu_driver_name: o.muDriverName,
          mu_driver_phone: o.muDriverPhone,
          mu_tracking_url: o.muTrackingUrl,
          mu_eta: o.muEta,
          scheduled_date: o.scheduledDate,
          envia_carrier: o.enviaCarrier,
          envia_label_url: o.enviaLabelUrl,
          envia_delivery_estimate: o.enviaDeliveryEstimate,
        }));
      setOrders(shippingOrders);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const updateTracking = async (orderId: string, trackingNumber: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, status: 'shipped' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Numero de guia actualizado' });
      fetchPendingShipments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const markDelivered = async (orderId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Pedido marcado como entregado' });
      fetchPendingShipments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const retryEnvia = async (orderId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/retry-envia`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Envio Envia reintentado' });
      fetchPendingShipments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const retryMu = async (orderId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/retry-mu`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Servicio MU creado exitosamente' });
      fetchPendingShipments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const cancelMu = async (orderId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/cancel-mu`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Servicio MU cancelado' });
      fetchPendingShipments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const standardPreparing = orders.filter(o => (o.status === 'paid' || o.status === 'preparing') && o.delivery_method !== 'mensajeros_urbanos' && o.delivery_method !== 'envia');
  const standardShipped = orders.filter(o => o.status === 'shipped' && o.delivery_method !== 'mensajeros_urbanos' && o.delivery_method !== 'envia');
  const muOrders = orders.filter(o => o.delivery_method === 'mensajeros_urbanos');
  const enviaOrders = orders.filter(o => o.delivery_method === 'envia');

  return (
    <div className="space-y-8">


      <section>
        <h3 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-orange-500" />Por Enviar ({standardPreparing.length})
        </h3>

        {standardPreparing.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay pedidos pendientes de envio</p>
          </div>
        ) : (
          <div className="space-y-4">
            {standardPreparing.map(order => (
              <div key={order.id} className="bg-card rounded-xl p-6 shadow-soft border-l-4 border-orange-500">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-medium text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('es-CO')}</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground">{order.shipping_name}</p>
                          <p className="text-sm text-muted-foreground">{order.shipping_phone}</p>
                          <p className="text-sm text-foreground mt-1">{order.shipping_address}</p>
                          <p className="text-sm text-foreground">{order.shipping_city}{order.shipping_department && `, ${order.shipping_department}`}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <p className="font-display text-xl font-bold text-foreground text-right">${order.total.toLocaleString('es-CO')}</p>
                    <div className="flex flex-col gap-2">
                      <input type="text" placeholder="Numero de guia" defaultValue={order.tracking_number || ''}
                        id={`tracking-${order.id}`}
                        className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
                      <button
                        onClick={() => {
                          const input = document.getElementById(`tracking-${order.id}`) as HTMLInputElement;
                          if (input?.value) updateTracking(order.id, input.value);
                        }}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                        <Truck className="h-4 w-4" />Marcar Enviado
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />En Transito ({standardShipped.length})
        </h3>

        {standardShipped.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl">
            <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay envios en transito</p>
          </div>
        ) : (
          <div className="space-y-4">
            {standardShipped.map(order => (
              <div key={order.id} className="bg-card rounded-xl p-6 shadow-soft border-l-4 border-primary">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className="text-primary font-medium">Guia: {order.tracking_number}</span>
                    </div>
                    <p className="font-semibold text-foreground">{order.shipping_name}</p>
                    <p className="text-sm text-muted-foreground">{order.shipping_city}{order.shipping_department && `, ${order.shipping_department}`}</p>
                  </div>
                  <button onClick={() => markDelivered(order.id)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                    Marcar Entregado
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5 text-blue-500" />Mensajeros Urbanos ({muOrders.length})
        </h3>

        {muOrders.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl">
            <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay pedidos con Mensajeros Urbanos</p>
          </div>
        ) : (
          <div className="space-y-4">
            {muOrders.map(order => {
              const muBadge = order.mu_status ? (MU_STATUS_BADGE[order.mu_status] ?? { label: order.mu_status, className: 'bg-muted text-muted-foreground' }) : null;
              const canRetry = order.mu_status === 'error';
              const canCancel = order.mu_status === 'on_hold' || order.mu_status === 'create' || !order.mu_status;
              return (
                <div key={order.id} className="bg-card rounded-xl p-6 shadow-soft border-l-4 border-blue-500">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="text-sm font-medium text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                        <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('es-CO')}</span>
                        {muBadge && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${muBadge.className}`}>
                            {muBadge.label}
                          </span>
                        )}
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-foreground">{order.shipping_name}</p>
                            <p className="text-sm text-muted-foreground">{order.shipping_phone}</p>
                            <p className="text-sm text-foreground mt-1">{order.shipping_address}</p>
                            <p className="text-sm text-foreground">{order.shipping_city}{order.shipping_department && `, ${order.shipping_department}`}</p>
                          </div>
                        </div>
                        {(order.mu_driver_name || order.mu_driver_phone) && (
                          <div className="pt-2 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Mensajero</p>
                            {order.mu_driver_name && <p className="text-sm text-foreground">{order.mu_driver_name}</p>}
                            {order.mu_driver_phone && <p className="text-sm text-muted-foreground">{order.mu_driver_phone}</p>}
                          </div>
                        )}
                        {order.scheduled_date && (
                          <p className="text-xs text-muted-foreground pt-1">
                            Programado: {new Date(order.scheduled_date).toLocaleDateString('es-CO')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 items-end">
                      <p className="font-display text-xl font-bold text-foreground">${order.total.toLocaleString('es-CO')}</p>
                      <div className="flex flex-col gap-2">
                        {order.mu_tracking_url && (
                          <a
                            href={order.mu_tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />Ver tracking
                          </a>
                        )}
                        {canRetry && (
                          <button
                            onClick={() => retryMu(order.id)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                            <Truck className="h-4 w-4" />Reintentar MU
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => cancelMu(order.id)}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
                            Cancelar MU
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-green-500" />Envios Nacionales — Envia ({enviaOrders.length})
        </h3>

        {enviaOrders.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay pedidos con Envia</p>
          </div>
        ) : (
          <div className="space-y-4">
            {enviaOrders.map(order => {
              const canRetry = order.status === 'error';
              return (
                <div key={order.id} className="bg-card rounded-xl p-6 shadow-soft border-l-4 border-green-500">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="text-sm font-medium text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                        <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('es-CO')}</span>
                        {order.envia_carrier && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                            {order.envia_carrier}
                          </span>
                        )}
                        {order.tracking_number && (
                          <span className="text-xs font-medium text-muted-foreground">Guia: {order.tracking_number}</span>
                        )}
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-foreground">{order.shipping_name}</p>
                            <p className="text-sm text-muted-foreground">{order.shipping_phone}</p>
                            <p className="text-sm text-foreground mt-1">{order.shipping_address}</p>
                            <p className="text-sm text-foreground">{order.shipping_city}{order.shipping_department && `, ${order.shipping_department}`}</p>
                          </div>
                        </div>
                        {order.envia_delivery_estimate && (
                          <p className="text-xs text-muted-foreground pt-1">
                            Entrega estimada: {order.envia_delivery_estimate}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 items-end">
                      <p className="font-display text-xl font-bold text-foreground">${order.total.toLocaleString('es-CO')}</p>
                      <div className="flex flex-col gap-2">
                        {order.envia_label_url && (
                          <a
                            href={order.envia_label_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />Descargar guia
                          </a>
                        )}
                        {order.mu_tracking_url && (
                          <a
                            href={order.mu_tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />Ver tracking
                          </a>
                        )}
                        {canRetry && (
                          <button
                            onClick={() => retryEnvia(order.id)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                            <Package className="h-4 w-4" />Reintentar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
