'use client';

import { useState, useEffect } from 'react';
import { Truck, Package, Loader2, MapPin } from 'lucide-react';
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
}

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
        .filter((o: any) => ['paid', 'preparing', 'shipped'].includes(o.status))
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

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const preparingOrders = orders.filter(o => o.status === 'paid' || o.status === 'preparing');
  const shippedOrders = orders.filter(o => o.status === 'shipped');

  return (
    <div className="space-y-8">
      

      <section>
        <h3 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-orange-500" />Por Enviar ({preparingOrders.length})
        </h3>

        {preparingOrders.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay pedidos pendientes de envio</p>
          </div>
        ) : (
          <div className="space-y-4">
            {preparingOrders.map(order => (
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
          <Truck className="h-5 w-5 text-primary" />En Transito ({shippedOrders.length})
        </h3>

        {shippedOrders.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl">
            <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay envios en transito</p>
          </div>
        ) : (
          <div className="space-y-4">
            {shippedOrders.map(order => (
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
    </div>
  );
}
