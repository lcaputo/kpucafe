import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import { Package, Truck, CheckCircle, Clock, ChevronRight, Loader2 } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  total: number;
  tracking_number: string | null;
  created_at: string;
  shipping_city: string;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: 'Pendiente', icon: Clock, color: 'text-yellow-500' },
  paid: { label: 'Pagado', icon: CheckCircle, color: 'text-blue-500' },
  preparing: { label: 'Preparando', icon: Package, color: 'text-orange-500' },
  shipped: { label: 'Enviado', icon: Truck, color: 'text-primary' },
  delivered: { label: 'Entregado', icon: CheckCircle, color: 'text-green-500' },
  cancelled: { label: 'Cancelado', icon: Clock, color: 'text-red-500' },
};

export default function MyOrders() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, status, total, tracking_number, created_at, shipping_city')
      .order('created_at', { ascending: false });
    
    setOrders(data || []);
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const activeOrders = orders.filter(o => ['pending', 'paid', 'preparing', 'shipped'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <h1 className="font-display text-3xl font-bold text-foreground mb-8">
            Mis Pedidos
          </h1>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl">
              <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                No tienes pedidos aún
              </h2>
              <p className="text-muted-foreground mb-6">
                ¡Explora nuestros productos y haz tu primer pedido!
              </p>
              <Link to="/#productos" className="btn-kpu inline-block">
                Ver Productos
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Active Orders */}
              {activeOrders.length > 0 && (
                <section>
                  <h2 className="font-display text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Pedidos Activos ({activeOrders.length})
                  </h2>
                  <div className="space-y-4">
                    {activeOrders.map(order => {
                      const status = statusConfig[order.status];
                      const StatusIcon = status.icon;
                      
                      return (
                        <div 
                          key={order.id}
                          className="bg-card rounded-xl p-6 shadow-soft hover:shadow-elevated transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <StatusIcon className={`h-5 w-5 ${status.color}`} />
                                <span className={`font-semibold ${status.color}`}>
                                  {status.label}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Pedido #{order.id.slice(0, 8).toUpperCase()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(order.created_at).toLocaleDateString('es-CO', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </p>
                              {order.tracking_number && (
                                <p className="text-sm text-primary mt-1">
                                  Guía: {order.tracking_number}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-display text-xl font-bold text-foreground">
                                ${order.total.toLocaleString('es-CO')}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {order.shipping_city}
                              </p>
                              <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto mt-2" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Completed Orders */}
              {completedOrders.length > 0 && (
                <section>
                  <h2 className="font-display text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Historial de Compras ({completedOrders.length})
                  </h2>
                  <div className="space-y-4">
                    {completedOrders.map(order => {
                      const status = statusConfig[order.status];
                      const StatusIcon = status.icon;
                      
                      return (
                        <div 
                          key={order.id}
                          className="bg-card rounded-xl p-6 shadow-soft opacity-80"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <StatusIcon className={`h-5 w-5 ${status.color}`} />
                                <span className={`font-semibold ${status.color}`}>
                                  {status.label}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Pedido #{order.id.slice(0, 8).toUpperCase()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(order.created_at).toLocaleDateString('es-CO', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-display text-xl font-bold text-foreground">
                                ${order.total.toLocaleString('es-CO')}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {order.shipping_city}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
