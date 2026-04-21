'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/header';
import Footer from '@/components/footer';
import {
  Coffee, Calendar, CreditCard, Pause, Play, XCircle,
  Loader2, ChevronDown, ChevronUp, Plus, RefreshCw,
} from 'lucide-react';

interface BillingRecord {
  id: string;
  amount: number;
  status: string;
  epaycoRef: string | null;
  createdAt: string;
}

interface Subscription {
  id: string;
  planName: string;
  frequency: string;
  status: string;
  nextDeliveryDate: string;
  price: number;
  shippingCity: string;
  product: { name: string } | null;
  variant: { weight: string; grind: string } | null;
  plan: { frequencyLabel: string } | null;
  paymentMethod: { franchise: string; mask: string } | null;
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

const BILLING_STATUS_COLORS: Record<string, string> = {
  approved: 'text-green-600',
  rejected: 'text-red-500',
  pending: 'text-yellow-600',
  failed: 'text-red-500',
};

export default function MisSuscripciones() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [billingRecords, setBillingRecords] = useState<Record<string, BillingRecord[]>>({});
  const [loadingBilling, setLoadingBilling] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [authLoading, user, router]);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/subscriptions');
      if (!res.ok) throw new Error('Error al cargar suscripciones');
      setSubscriptions((await res.json()) || []);
    } catch {
      toast({ title: 'Error al cargar suscripciones', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) fetchSubscriptions();
  }, [user, fetchSubscriptions]);

  const toggleExpanded = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!billingRecords[id]) {
      setLoadingBilling(id);
      try {
        const res = await fetch(`/api/subscriptions/${id}/billing`);
        const data = await res.json();
        setBillingRecords(r => ({ ...r, [id]: data }));
      } catch {
        setBillingRecords(r => ({ ...r, [id]: [] }));
      } finally {
        setLoadingBilling(null);
      }
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Error al actualizar estado');
      const label = status === 'active' ? 'reactivada' : status === 'paused' ? 'pausada' : 'cancelada';
      toast({ title: `Suscripción ${label}` });
      fetchSubscriptions();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl font-bold text-foreground">Mis Suscripciones</h1>
            <Link href="/suscribirse" className="btn-kpu flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Nueva
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl">
              <RefreshCw className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="font-display text-xl font-semibold mb-2">No tienes suscripciones</h2>
              <p className="text-muted-foreground mb-6">¡Suscríbete y recibe café fresco automáticamente!</p>
              <Link href="/#suscripciones" className="btn-kpu inline-block">Ver Planes</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map(sub => (
                <div key={sub.id} className="bg-card rounded-2xl shadow-soft overflow-hidden">
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2 ${STATUS_COLORS[sub.status] || STATUS_COLORS.cancelled}`}>
                          {sub.status === 'active' ? 'Activa' : sub.status === 'paused' ? 'Pausada' : 'Cancelada'}
                        </span>
                        <h3 className="font-display text-lg font-bold text-foreground">
                          {sub.product?.name || sub.planName}
                        </h3>
                        {sub.variant && (
                          <p className="text-sm text-muted-foreground">{sub.variant.weight} · {sub.variant.grind}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-display text-2xl font-bold text-primary">${sub.price.toLocaleString('es-CO')}</p>
                        <p className="text-xs text-muted-foreground">{FREQ_LABELS[sub.frequency] || sub.frequency}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Próximo: <span className="text-foreground font-medium">
                          {new Date(sub.nextDeliveryDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                        </span></span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Coffee className="h-4 w-4" />
                        <span>{sub.shippingCity}</span>
                      </div>
                      {sub.paymentMethod && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CreditCard className="h-4 w-4" />
                          <span>{sub.paymentMethod.franchise} •••• {sub.paymentMethod.mask.slice(-4)}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      {sub.status === 'active' && (
                        <button onClick={() => updateStatus(sub.id, 'paused')} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground">
                          <Pause className="h-3.5 w-3.5" /> Pausar
                        </button>
                      )}
                      {sub.status === 'paused' && (
                        <button onClick={() => updateStatus(sub.id, 'active')} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                          <Play className="h-3.5 w-3.5" /> Reactivar
                        </button>
                      )}
                      {sub.status !== 'cancelled' && (
                        <button onClick={() => { if (confirm('¿Cancelar esta suscripción?')) updateStatus(sub.id, 'cancelled'); }} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5" /> Cancelar
                        </button>
                      )}
                      <button onClick={() => toggleExpanded(sub.id)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground ml-auto">
                        {expandedId === sub.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        Historial
                      </button>
                    </div>
                  </div>

                  {/* Billing history accordion */}
                  {expandedId === sub.id && (
                    <div className="border-t border-border px-5 sm:px-6 py-4 bg-muted/30">
                      <p className="text-sm font-semibold text-foreground mb-3">Historial de cobros</p>
                      {loadingBilling === sub.id ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>
                      ) : (billingRecords[sub.id] || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin cobros registrados.</p>
                      ) : (
                        <div className="space-y-2">
                          {(billingRecords[sub.id] || []).map(r => (
                            <div key={r.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-3">
                                <span className={`font-medium capitalize ${BILLING_STATUS_COLORS[r.status]}`}>
                                  {r.status === 'approved' ? 'Aprobado' : r.status === 'rejected' ? 'Rechazado' : r.status === 'pending' ? 'Pendiente' : 'Fallido'}
                                </span>
                                <span className="text-muted-foreground">${r.amount.toLocaleString('es-CO')}</span>
                              </div>
                              <div className="text-right">
                                {r.epaycoRef && <p className="text-xs text-muted-foreground font-mono">{r.epaycoRef}</p>}
                                <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('es-CO')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
