'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, RefreshCw, Pause, Play, XCircle,
  RotateCcw, TrendingUp, Users, PauseCircle, AlertCircle,
} from 'lucide-react';

interface Stats {
  active: number;
  paused: number;
  cancelled: number;
  mrr: number;
  churnRate: number;
}

interface Subscription {
  id: string;
  planName: string;
  frequency: string;
  status: string;
  price: number;
  nextDeliveryDate: string;
  userId: string;
  product: { name: string } | null;
  variant: { weight: string; grind: string } | null;
  plan: { name: string; frequencyLabel: string } | null;
  paymentMethod: { franchise: string; mask: string } | null;
  user: { email: string; profile: { fullName: string | null } | null } | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function AdminSubscriptionsPage() {
  const { toast } = useToast();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subsRes, statsRes] = await Promise.all([
        fetch('/api/admin/subscriptions'),
        fetch('/api/admin/subscriptions/stats'),
      ]);
      setSubs(await subsRes.json());
      setStats(await statsRes.json());
    } catch {
      toast({ title: 'Error al cargar datos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      toast({ title: `Suscripción ${status === 'active' ? 'activada' : status === 'paused' ? 'pausada' : 'cancelada'}` });
      fetchData();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const retryCharge = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}/charge`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'approved') toast({ title: 'Cobro aprobado' });
      else toast({ title: `Cobro ${data.status}`, description: data.epaycoRef || '', variant: 'destructive' });
      fetchData();
    } catch {
      toast({ title: 'Error al reintentar cobro', variant: 'destructive' });
    }
  };

  const filtered = filter === 'all' ? subs : subs.filter(s => s.status === filter);

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'MRR', value: `$${stats.mrr.toLocaleString('es-CO')}`, icon: TrendingUp, color: 'text-primary' },
            { label: 'Activas', value: stats.active, icon: Users, color: 'text-green-500' },
            { label: 'Pausadas', value: stats.paused, icon: PauseCircle, color: 'text-yellow-500' },
            { label: 'Churn 30d', value: `${stats.churnRate}%`, icon: AlertCircle, color: 'text-red-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card rounded-xl p-4 shadow-soft flex items-center gap-3">
              <Icon className={`h-8 w-8 ${color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-display text-xl font-bold text-foreground">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2">
          {['all', 'active', 'paused', 'cancelled'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : f === 'paused' ? 'Pausadas' : 'Canceladas'}
            </button>
          ))}
        </div>
        <button onClick={fetchData} className="p-2 text-muted-foreground hover:text-primary transition-colors">
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl">
          <p className="text-muted-foreground">No hay suscripciones.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  {['Cliente', 'Café', 'Plan', 'Precio', 'Estado', 'Próximo cobro', 'Tarjeta', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-sm font-semibold text-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(sub => (
                  <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/suscripciones/${sub.id}`} className="hover:text-primary">
                        <p className="font-medium text-sm">{sub.user?.profile?.fullName || '—'}</p>
                        <p className="text-xs text-muted-foreground">{sub.user?.email}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p>{sub.product?.name || sub.planName || '—'}</p>
                      {sub.variant && <p className="text-xs text-muted-foreground">{sub.variant.weight} · {sub.variant.grind}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm">{sub.plan?.name || sub.planName || '—'}</td>
                    <td className="px-4 py-3 text-sm font-mono">${sub.price.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[sub.status] || STATUS_COLORS.cancelled}`}>
                        {sub.status === 'active' ? 'Activa' : sub.status === 'paused' ? 'Pausada' : 'Cancelada'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(sub.nextDeliveryDate).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {sub.paymentMethod ? `${sub.paymentMethod.franchise} •••• ${sub.paymentMethod.mask.slice(-4)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {sub.status === 'active' && (
                          <button onClick={() => updateStatus(sub.id, 'paused')} title="Pausar" className="p-1.5 rounded text-muted-foreground hover:text-yellow-600 hover:bg-yellow-50 transition-colors">
                            <Pause className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {sub.status === 'paused' && (
                          <>
                            <button onClick={() => updateStatus(sub.id, 'active')} title="Reactivar" className="p-1.5 rounded text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors">
                              <Play className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => retryCharge(sub.id)} title="Reintentar cobro" className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {sub.status !== 'cancelled' && (
                          <button onClick={() => { if (confirm('¿Cancelar?')) updateStatus(sub.id, 'cancelled'); }} title="Cancelar" className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <XCircle className="h-3.5 w-3.5" />
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
