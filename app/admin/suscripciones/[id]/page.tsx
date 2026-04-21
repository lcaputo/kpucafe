'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, RotateCcw, Pause, Play, XCircle } from 'lucide-react';

interface BillingRecord {
  id: string;
  amount: number;
  status: string;
  epaycoRef: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
}

interface SubscriptionDetail {
  id: string;
  planName: string;
  frequency: string;
  status: string;
  price: number;
  nextDeliveryDate: string;
  shippingAddress: string;
  shippingCity: string;
  product: { name: string } | null;
  variant: { weight: string; grind: string } | null;
  plan: { name: string; frequencyLabel: string } | null;
  paymentMethod: { franchise: string; mask: string; expMonth: string; expYear: string } | null;
  user: { email: string; profile: { fullName: string | null; phone: string | null } | null } | null;
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'text-green-600 bg-green-50',
  rejected: 'text-red-500 bg-red-50',
  pending: 'text-yellow-600 bg-yellow-50',
  failed: 'text-red-500 bg-red-50',
};

export default function AdminSubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [billing, setBilling] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, billingRes] = await Promise.all([
        fetch(`/api/admin/subscriptions/${id}`),
        fetch(`/api/admin/subscriptions/${id}/billing`),
      ]);
      if (!subRes.ok || !billingRes.ok) throw new Error('Error al cargar');
      setSub(await subRes.json());
      setBilling(await billingRes.json());
    } catch {
      toast({ title: 'Error al cargar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const updateStatus = async (status: string) => {
    try {
      await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      toast({ title: 'Estado actualizado' });
      await fetchData();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const retryCharge = async () => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}/charge`, { method: 'POST' });
      const data = await res.json();
      toast({ title: data.status === 'approved' ? 'Cobro aprobado' : `Cobro ${data.status}` });
      await fetchData();
    } catch {
      toast({ title: 'Error al cobrar', variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!sub) return <p className="text-muted-foreground">Suscripción no encontrada.</p>;

  return (
    <div className="max-w-3xl">
      <Link href="/admin/suscripciones" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {/* Info */}
        <div className="bg-card rounded-xl p-5 shadow-soft">
          <h2 className="font-semibold text-foreground mb-3">Información</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Cliente</dt><dd>{sub.user?.profile?.fullName || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd className="truncate max-w-[180px]">{sub.user?.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Café</dt><dd>{sub.product?.name || sub.planName}</dd></div>
            {sub.variant && <div className="flex justify-between"><dt className="text-muted-foreground">Variante</dt><dd>{sub.variant.weight} · {sub.variant.grind}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted-foreground">Plan</dt><dd>{sub.plan?.name || sub.planName}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Precio</dt><dd className="font-mono">${sub.price.toLocaleString('es-CO')}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Próximo cobro</dt><dd>{new Date(sub.nextDeliveryDate).toLocaleDateString('es-CO')}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Dirección</dt><dd className="text-right max-w-[180px]">{sub.shippingAddress}, {sub.shippingCity}</dd></div>
            {sub.paymentMethod && (
              <div className="flex justify-between"><dt className="text-muted-foreground">Tarjeta</dt><dd>{sub.paymentMethod.franchise} •••• {sub.paymentMethod.mask.slice(-4)}</dd></div>
            )}
          </dl>
        </div>

        {/* Actions */}
        <div className="bg-card rounded-xl p-5 shadow-soft">
          <h2 className="font-semibold text-foreground mb-3">Acciones</h2>
          <div className="space-y-2">
            {sub.status === 'active' && (
              <button onClick={() => updateStatus('paused')} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-muted text-sm text-foreground transition-colors">
                <Pause className="h-4 w-4" /> Pausar suscripción
              </button>
            )}
            {sub.status === 'paused' && (
              <>
                <button onClick={() => updateStatus('active')} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">
                  <Play className="h-4 w-4" /> Reactivar suscripción
                </button>
                <button onClick={retryCharge} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-primary/10 hover:border-primary/30 text-sm text-foreground transition-colors">
                  <RotateCcw className="h-4 w-4" /> Reintentar cobro
                </button>
              </>
            )}
            {sub.status !== 'cancelled' && (
              <button onClick={() => { if (confirm('¿Cancelar esta suscripción?')) updateStatus('cancelled'); }} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive text-sm text-foreground transition-colors">
                <XCircle className="h-4 w-4" /> Cancelar suscripción
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Billing history */}
      <div className="bg-card rounded-xl shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Historial de cobros</h2>
        </div>
        {billing.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Sin cobros registrados.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {['Fecha', 'Monto', 'Estado', 'Ref ePayco', 'Intentos', 'Error'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {billing.map(r => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3 text-sm font-mono">${r.amount.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || ''}`}>
                      {r.status === 'approved' ? 'Aprobado' : r.status === 'rejected' ? 'Rechazado' : r.status === 'pending' ? 'Pendiente' : 'Fallido'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.epaycoRef || '—'}</td>
                  <td className="px-4 py-3 text-sm text-center">{r.retryCount}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">{r.errorMessage || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
