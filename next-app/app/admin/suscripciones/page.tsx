'use client';

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Pause, Play, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Subscription {
  id: string;
  user_id: string;
  product_id: string | null;
  variant_id: string | null;
  frequency: string;
  status: string | null;
  price: number;
  shipping_address: string;
  shipping_city: string;
  next_delivery_date: string;
  created_at: string;
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function AdminSubscriptionsPage() {
  const { toast } = useToast();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [productNames, setProductNames] = useState<Record<string, string>>({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [subsRes, productsRes] = await Promise.all([
        fetch('/api/admin/subscriptions'),
        fetch('/api/admin/subscriptions/products'),
      ]);
      const subsData = await subsRes.json();
      const productsData = await productsRes.json();

      setSubs((subsData as any[]).map((s: any) => ({
        id: s.id,
        user_id: s.userId,
        product_id: s.productId,
        variant_id: s.variantId,
        frequency: s.frequency,
        status: s.status,
        price: s.price,
        shipping_address: s.shippingAddress,
        shipping_city: s.shippingCity,
        next_delivery_date: s.nextDeliveryDate,
        created_at: s.createdAt,
      })));
      const names: Record<string, string> = {};
      (productsData as any[]).forEach((p: any) => { names[p.id] = p.name; });
      setProductNames(names);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: `Suscripcion ${status === 'active' ? 'activada' : status === 'paused' ? 'pausada' : 'cancelada'}` });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-bold text-foreground">Suscripciones</h2>
        <button onClick={fetchData} className="p-2 text-muted-foreground hover:text-primary transition-colors">
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {subs.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl">
          <RefreshCw className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">No hay suscripciones</h3>
          <p className="text-muted-foreground">Las suscripciones de los clientes apareceran aqui</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 sm:px-6 py-4 text-sm font-semibold text-foreground">Producto</th>
                  <th className="text-left px-4 sm:px-6 py-4 text-sm font-semibold text-foreground hidden md:table-cell">Frecuencia</th>
                  <th className="text-left px-4 sm:px-6 py-4 text-sm font-semibold text-foreground">Precio</th>
                  <th className="text-left px-4 sm:px-6 py-4 text-sm font-semibold text-foreground hidden lg:table-cell">Proxima entrega</th>
                  <th className="text-left px-4 sm:px-6 py-4 text-sm font-semibold text-foreground hidden sm:table-cell">Direccion</th>
                  <th className="text-left px-4 sm:px-6 py-4 text-sm font-semibold text-foreground">Estado</th>
                  <th className="text-right px-4 sm:px-6 py-4 text-sm font-semibold text-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subs.map(sub => (
                  <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <p className="font-semibold text-foreground">{sub.product_id ? productNames[sub.product_id] || 'Producto' : '-'}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{FREQ_LABELS[sub.frequency] || sub.frequency}</p>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-foreground hidden md:table-cell">{FREQ_LABELS[sub.frequency] || sub.frequency}</td>
                    <td className="px-4 sm:px-6 py-4 text-foreground">${sub.price.toLocaleString('es-CO')}</td>
                    <td className="px-4 sm:px-6 py-4 text-foreground hidden lg:table-cell">
                      {new Date(sub.next_delivery_date).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-foreground hidden sm:table-cell">
                      <p className="text-sm truncate max-w-[200px]">{sub.shipping_address}, {sub.shipping_city}</p>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status || 'active']}`}>
                        {sub.status === 'active' ? 'Activa' : sub.status === 'paused' ? 'Pausada' : 'Cancelada'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {sub.status === 'active' && (
                          <button onClick={() => updateStatus(sub.id, 'paused')} className="p-2 text-muted-foreground hover:text-yellow-600 transition-colors" title="Pausar">
                            <Pause className="h-4 w-4" />
                          </button>
                        )}
                        {sub.status === 'paused' && (
                          <button onClick={() => updateStatus(sub.id, 'active')} className="p-2 text-muted-foreground hover:text-green-600 transition-colors" title="Reactivar">
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        {sub.status !== 'cancelled' && (
                          <button onClick={() => { if (confirm('Cancelar esta suscripcion?')) updateStatus(sub.id, 'cancelled'); }} className="p-2 text-muted-foreground hover:text-destructive transition-colors" title="Cancelar">
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
