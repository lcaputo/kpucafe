'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import Header from '@/components/header';
import Footer from '@/components/footer';
import CartDrawer from '@/components/cart-drawer';
import { Package, Truck, CheckCircle, Clock, ChevronDown, ChevronUp, Loader2, MapPin, X } from 'lucide-react';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  variant_info: string;
}

interface Order {
  id: string;
  status: string;
  total: number;
  tracking_number: string | null;
  carrier: string | null;
  created_at: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_department: string | null;
  notes: string | null;
}

const STATUS_STEPS = ['pending', 'paid', 'preparing', 'shipped', 'delivered'];

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: 'Pendiente', icon: Clock, color: 'text-yellow-500' },
  paid: { label: 'Pagado', icon: CheckCircle, color: 'text-blue-500' },
  preparing: { label: 'Preparando', icon: Package, color: 'text-orange-500' },
  shipped: { label: 'Enviado', icon: Truck, color: 'text-primary' },
  delivered: { label: 'Entregado', icon: CheckCircle, color: 'text-green-500' },
  cancelled: { label: 'Cancelado', icon: X, color: 'text-red-500' },
};

export default function MyOrders() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth');
    }
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
        shipping_phone: o.shippingPhone,
        shipping_address: o.shippingAddress,
        shipping_city: o.shippingCity,
        shipping_department: o.shippingDepartment,
        notes: o.notes,
      })));
    } catch {
      // silently fail
    }
    setLoading(false);
  };

  const toggleExpand = async (orderId: string) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (!orderItems[orderId]) {
      try {
        const res = await fetch(`/api/orders/${orderId}/items`);
        const data = await res.json();
        setOrderItems(prev => ({
          ...prev,
          [orderId]: (data || []).map((i: any) => ({
            id: i.id,
            product_name: i.productName,
            quantity: i.quantity,
            unit_price: i.unitPrice,
            variant_info: i.variantInfo,
          })),
        }));
      } catch {
        // silently fail
      }
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const activeOrders = orders.filter(o => ['pending', 'paid', 'preparing', 'shipped'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-8">Mis Pedidos</h1>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl">
              <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="font-display text-xl font-semibold text-foreground mb-2">No tienes pedidos aun</h2>
              <p className="text-muted-foreground mb-6">Explora nuestros productos y haz tu primer pedido!</p>
              <Link href="/#productos" className="btn-kpu inline-block">Ver Productos</Link>
            </div>
          ) : (
            <div className="space-y-8">
              {activeOrders.length > 0 && (
                <OrderSection title="Pedidos Activos" count={activeOrders.length} icon={<Truck className="h-5 w-5 text-primary" />}>
                  {activeOrders.map(order => (
                    <OrderCard key={order.id} order={order} expanded={expandedOrderId === order.id} onToggle={() => toggleExpand(order.id)} items={orderItems[order.id]} />
                  ))}
                </OrderSection>
              )}
              {completedOrders.length > 0 && (
                <OrderSection title="Historial" count={completedOrders.length} icon={<CheckCircle className="h-5 w-5 text-green-500" />}>
                  {completedOrders.map(order => (
                    <OrderCard key={order.id} order={order} expanded={expandedOrderId === order.id} onToggle={() => toggleExpand(order.id)} items={orderItems[order.id]} />
                  ))}
                </OrderSection>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function OrderSection({ title, count, icon, children }: { title: string; count: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        {icon} {title} ({count})
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function OrderCard({ order, expanded, onToggle, items }: { order: Order; expanded: boolean; onToggle: () => void; items?: OrderItem[] }) {
  const status = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const isCancelled = order.status === 'cancelled';
  const stepIndex = isCancelled ? -1 : STATUS_STEPS.indexOf(order.status);

  return (
    <div className="bg-card rounded-xl shadow-soft overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 sm:p-5 text-left">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusIcon className={`h-4 w-4 ${status.color}`} />
              <span className={`text-sm font-semibold ${status.color}`}>{status.label}</span>
              <span className="text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="font-display text-foreground">${order.total.toLocaleString('es-CO')}</span>
            </div>
            {order.tracking_number && (
              <p className="text-xs text-primary mt-1">
                {order.carrier && `${order.carrier} - `}Guia: {order.tracking_number}
              </p>
            )}
          </div>
          {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      <div className="px-4 sm:px-5 pb-3 flex justify-end">
        <Link href={`/pedido/${order.id}`} className="text-xs font-medium text-primary hover:underline">
          Ver detalle →
        </Link>
      </div>

      {expanded && (
        <div className="px-4 sm:px-5 pb-5 border-t border-border pt-4 space-y-5">
          {/* Status stepper */}
          {!isCancelled && (
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Estado del pedido</p>
              <div className="flex items-center justify-between relative">
                {/* Line behind */}
                <div className="absolute left-0 right-0 top-4 h-0.5 bg-border" />
                <div className="absolute left-0 top-4 h-0.5 bg-primary transition-all" style={{ width: `${(stepIndex / (STATUS_STEPS.length - 1)) * 100}%` }} />
                {STATUS_STEPS.map((s, i) => {
                  const cfg = statusConfig[s];
                  const done = i <= stepIndex;
                  return (
                    <div key={s} className="relative z-10 flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        done ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground'
                      }`}>
                        {done ? <CheckCircle className="h-4 w-4" /> : i + 1}
                      </div>
                      <span className={`text-[10px] sm:text-xs mt-1 text-center ${done ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Shipping info */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" /> Direccion de envio
            </p>
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium text-foreground">{order.shipping_name}</p>
              <p className="text-muted-foreground">{order.shipping_phone}</p>
              <p className="text-foreground">{order.shipping_address}</p>
              <p className="text-foreground">{order.shipping_city}{order.shipping_department && `, ${order.shipping_department}`}</p>
              {order.notes && <p className="text-xs text-muted-foreground mt-1 italic">Nota: {order.notes}</p>}
            </div>
          </div>

          {/* Order items */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Productos</p>
            {items ? (
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm bg-muted/50 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-foreground">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{item.variant_info} x {item.quantity}</p>
                    </div>
                    <p className="font-semibold text-foreground">${(item.unit_price * item.quantity).toLocaleString('es-CO')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
