'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import Header from '@/components/header';
import Footer from '@/components/footer';
import CartDrawer from '@/components/cart-drawer';
import { Package, Truck, CheckCircle, Clock, X, Loader2, ExternalLink } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  total: number;
  tracking_number: string | null;
  carrier: string | null;
  created_at: string;
  shipping_name: string;
  shipping_city: string;
  shipping_department: string | null;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pending:   { label: 'Pendiente',   icon: Clock,        color: 'text-yellow-700', bg: 'bg-yellow-100' },
  paid:      { label: 'Pagado',      icon: CheckCircle,  color: 'text-blue-700',   bg: 'bg-blue-100'   },
  preparing: { label: 'Preparando', icon: Package,      color: 'text-orange-700', bg: 'bg-orange-100' },
  shipped:   { label: 'Enviado',    icon: Truck,        color: 'text-primary',    bg: 'bg-primary/10' },
  delivered: { label: 'Entregado',  icon: CheckCircle,  color: 'text-green-700',  bg: 'bg-green-100'  },
  cancelled: { label: 'Cancelado',  icon: X,            color: 'text-red-700',    bg: 'bg-red-100'    },
};

export default function MyOrders() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders((data || []).map((o: any) => ({
        id: o.id,
        status: o.status,
        total: o.total,
        tracking_number: o.trackingNumber,
        carrier: o.carrier,
        created_at: o.createdAt,
        shipping_name: o.shippingName,
        shipping_city: o.shippingCity,
        shipping_department: o.shippingDepartment,
      })));
    } catch {
      // silently fail
    }
    setLoading(false);
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-8">
            Mis Pedidos
          </h1>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-2xl">
              <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                No tienes pedidos aun
              </h2>
              <p className="text-muted-foreground mb-6">
                Explora nuestros productos y haz tu primer pedido.
              </p>
              <Link href="/#productos" className="btn-kpu inline-flex">
                Ver Productos
              </Link>
            </div>
          ) : (
            <div className="bg-card rounded-2xl shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground uppercase tracking-wide text-xs">
                        Pedido
                      </th>
                      <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground uppercase tracking-wide text-xs">
                        Fecha
                      </th>
                      <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground uppercase tracking-wide text-xs">
                        Destino
                      </th>
                      <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground uppercase tracking-wide text-xs">
                        Estado
                      </th>
                      <th className="text-right px-5 py-3.5 font-semibold text-muted-foreground uppercase tracking-wide text-xs">
                        Total
                      </th>
                      <th className="px-5 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((order) => {
                      const cfg = statusConfig[order.status] ?? statusConfig.pending;
                      const StatusIcon = cfg.icon;
                      const dest = [order.shipping_city, order.shipping_department]
                        .filter(Boolean)
                        .join(', ');

                      return (
                        <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                            #{order.id.slice(0, 8).toUpperCase()}
                            {order.tracking_number && (
                              <p className="font-sans text-[11px] text-primary mt-0.5 non-italic">
                                {order.carrier && `${order.carrier} · `}{order.tracking_number}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4 text-foreground whitespace-nowrap">
                            {new Date(order.created_at).toLocaleDateString('es-CO', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-5 py-4 text-foreground">
                            <p className="font-medium">{order.shipping_name}</p>
                            {dest && <p className="text-xs text-muted-foreground">{dest}</p>}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right font-display text-foreground whitespace-nowrap">
                            ${order.total.toLocaleString('es-CO')}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Link
                              href={`/pedido/${order.id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              Ver detalle
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
