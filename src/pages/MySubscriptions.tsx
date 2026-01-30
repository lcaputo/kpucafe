import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import { Coffee, Calendar, Pause, Play, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Subscription {
  id: string;
  frequency: string;
  status: string;
  next_delivery_date: string;
  price: number;
  shipping_city: string;
  product_id: string;
}

const frequencyLabels: Record<string, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
};

export default function MySubscriptions() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubscriptions();
    }
  }, [user]);

  const fetchSubscriptions = async () => {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    
    setSubscriptions(data || []);
    setLoading(false);
  };

  const toggleSubscription = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la suscripción',
        variant: 'destructive',
      });
    } else {
      toast({
        title: newStatus === 'active' ? 'Suscripción activada' : 'Suscripción pausada',
        description: newStatus === 'active' 
          ? 'Tu próximo envío está programado' 
          : 'No recibirás envíos hasta que la reactives',
      });
      fetchSubscriptions();
    }
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

  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
  const pausedSubscriptions = subscriptions.filter(s => s.status === 'paused');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <h1 className="font-display text-3xl font-bold text-foreground mb-8">
            Mis Suscripciones
          </h1>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl">
              <RefreshCw className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                No tienes suscripciones activas
              </h2>
              <p className="text-muted-foreground mb-6">
                ¡Suscríbete y recibe café fresco en tu puerta automáticamente!
              </p>
              <Link to="/#suscripciones" className="btn-kpu inline-block">
                Ver Planes
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Active Subscriptions */}
              {activeSubscriptions.length > 0 && (
                <section>
                  <h2 className="font-display text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Coffee className="h-5 w-5 text-primary" />
                    Activas ({activeSubscriptions.length})
                  </h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    {activeSubscriptions.map(sub => (
                      <div 
                        key={sub.id}
                        className="bg-card rounded-xl p-6 shadow-soft border-2 border-primary/20"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold mb-2">
                              Activa
                            </span>
                            <h3 className="font-display text-lg font-bold text-foreground">
                              Plan {frequencyLabels[sub.frequency]}
                            </h3>
                          </div>
                          <div className="text-right">
                            <p className="font-display text-2xl font-bold text-primary">
                              ${sub.price.toLocaleString('es-CO')}
                            </p>
                            <p className="text-xs text-muted-foreground">por envío</p>
                          </div>
                        </div>

                        <div className="space-y-3 mb-6">
                          <div className="flex items-center gap-3 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Próximo envío:</span>
                            <span className="font-medium text-foreground">
                              {new Date(sub.next_delivery_date).toLocaleDateString('es-CO', {
                                day: 'numeric',
                                month: 'long',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <Coffee className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Destino:</span>
                            <span className="font-medium text-foreground">{sub.shipping_city}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleSubscription(sub.id, sub.status)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 border border-muted-foreground/30 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <Pause className="h-4 w-4" />
                          Pausar suscripción
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Paused Subscriptions */}
              {pausedSubscriptions.length > 0 && (
                <section>
                  <h2 className="font-display text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Pause className="h-5 w-5 text-yellow-500" />
                    Pausadas ({pausedSubscriptions.length})
                  </h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    {pausedSubscriptions.map(sub => (
                      <div 
                        key={sub.id}
                        className="bg-card rounded-xl p-6 shadow-soft opacity-75"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold mb-2">
                              Pausada
                            </span>
                            <h3 className="font-display text-lg font-bold text-foreground">
                              Plan {frequencyLabels[sub.frequency]}
                            </h3>
                          </div>
                          <div className="text-right">
                            <p className="font-display text-2xl font-bold text-muted-foreground">
                              ${sub.price.toLocaleString('es-CO')}
                            </p>
                            <p className="text-xs text-muted-foreground">por envío</p>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleSubscription(sub.id, sub.status)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          <Play className="h-4 w-4" />
                          Reactivar suscripción
                        </button>
                      </div>
                    ))}
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
