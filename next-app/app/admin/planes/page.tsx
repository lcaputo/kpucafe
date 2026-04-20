'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Loader2, Ticket, ArrowUp, ArrowDown, Star } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface Plan {
  id: string;
  name: string;
  frequency: string;
  frequency_label: string;
  price: number;
  original_price: number | null;
  discount: string | null;
  is_popular: boolean | null;
  features: string[];
  is_active: boolean | null;
  sort_order: number | null;
}

export default function AdminSubscriptionPlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [featureInput, setFeatureInput] = useState('');

  const [form, setForm] = useState({
    name: '',
    frequency: 'monthly',
    frequency_label: 'Cada mes',
    price: 30000,
    original_price: 35000,
    discount: '',
    is_popular: false,
    features: [] as string[],
    is_active: true,
  });

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/admin/subscription-plans');
      const data = await res.json();
      setPlans((data as any[]).map((p: any) => ({
        id: p.id,
        name: p.name,
        frequency: p.frequency,
        frequency_label: p.frequencyLabel,
        price: p.price,
        original_price: p.originalPrice,
        discount: p.discount,
        is_popular: p.isPopular,
        features: p.features,
        is_active: p.isActive,
        sort_order: p.sortOrder,
      })));
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const movePlan = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= plans.length) return;
    const updated = [...plans];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    try {
      await fetch('/api/admin/subscription-plans/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: updated.map(p => p.id) }),
      });
      setPlans(updated.map((p, i) => ({ ...p, sort_order: i })));
    } catch {
      // ignore
    }
  };

  const openModal = (plan?: Plan) => {
    if (plan) {
      setEditing(plan);
      setForm({
        name: plan.name,
        frequency: plan.frequency,
        frequency_label: plan.frequency_label,
        price: plan.price,
        original_price: plan.original_price || 0,
        discount: plan.discount || '',
        is_popular: plan.is_popular || false,
        features: plan.features || [],
        is_active: plan.is_active !== false,
      });
    } else {
      setEditing(null);
      setForm({ name: '', frequency: 'monthly', frequency_label: 'Cada mes', price: 30000, original_price: 35000, discount: '', is_popular: false, features: [], is_active: true });
    }
    setFeatureInput('');
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const addFeature = () => {
    if (!featureInput.trim()) return;
    setForm(prev => ({ ...prev, features: [...prev.features, featureInput.trim()] }));
    setFeatureInput('');
  };

  const removeFeature = (index: number) => {
    setForm(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      frequency: form.frequency,
      frequencyLabel: form.frequency_label,
      price: form.price,
      originalPrice: form.original_price || null,
      discount: form.discount || null,
      isPopular: form.is_popular,
      features: form.features,
      isActive: form.is_active,
    };

    try {
      if (editing) {
        const res = await fetch(`/api/admin/subscription-plans/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
        toast({ title: 'Plan actualizado' });
      } else {
        const res = await fetch('/api/admin/subscription-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, sortOrder: plans.length }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
        toast({ title: 'Plan creado' });
      }
      fetchPlans();
      closeModal();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Eliminar este plan?')) return;
    try {
      const res = await fetch(`/api/admin/subscription-plans/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Plan eliminado' }); fetchPlans();
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
        <h2 className="font-display text-2xl font-bold text-foreground">Planes de Suscripcion</h2>
        <button onClick={() => openModal()} className="btn-kpu flex items-center gap-2"><Plus className="h-5 w-5" />Nuevo Plan</button>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl">
          <Ticket className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">No hay planes</h3>
          <p className="text-muted-foreground mb-6">Crea tu primer plan de suscripcion</p>
          <button onClick={() => openModal()} className="btn-kpu inline-flex items-center gap-2"><Plus className="h-5 w-5" />Crear Plan</button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan, index) => (
            <div key={plan.id} className={`bg-card rounded-xl shadow-soft p-5 flex items-center gap-4 border-2 ${plan.is_popular ? 'border-primary/30' : 'border-transparent'}`}>
              <div className="flex flex-col gap-1">
                <button onClick={() => movePlan(index, 'up')} disabled={index === 0} className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"><ArrowUp className="h-4 w-4" /></button>
                <button onClick={() => movePlan(index, 'down')} disabled={index === plans.length - 1} className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"><ArrowDown className="h-4 w-4" /></button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-foreground text-lg">{plan.name}</p>
                  {plan.is_popular && <Star className="h-4 w-4 text-primary fill-primary" />}
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${plan.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {plan.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{plan.frequency_label}</span>
                  <span>&bull;</span>
                  <span className="font-semibold text-foreground">${plan.price.toLocaleString('es-CO')}</span>
                  {plan.original_price && (
                    <>
                      <span className="line-through">${plan.original_price.toLocaleString('es-CO')}</span>
                      {plan.discount && <span className="text-primary font-medium">-{plan.discount}</span>}
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{plan.features.length} caracteristicas</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch
                  checked={plan.is_active !== false}
                  onCheckedChange={async (checked) => {
                    try {
                      await fetch(`/api/admin/subscription-plans/${plan.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isActive: checked }),
                      });
                      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_active: checked } : p));
                      toast({ title: checked ? 'Plan activado' : 'Plan ocultado de la landing' });
                    } catch {
                      toast({ title: 'Error al cambiar estado', variant: 'destructive' });
                    }
                  }}
                  title={plan.is_active !== false ? 'Ocultar de landing' : 'Mostrar en landing'}
                />
                <button onClick={() => openModal(plan)} className="p-2 text-muted-foreground hover:text-primary transition-colors"><Edit className="h-4 w-4" /></button>
                <button onClick={() => deletePlan(plan.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <>
          <div className="fixed inset-0 bg-foreground/50 z-50" onClick={closeModal} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-card rounded-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="font-display text-xl font-bold text-foreground mb-6">{editing ? 'Editar Plan' : 'Nuevo Plan'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Nombre *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Quincenal" className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Frecuencia</label>
                    <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="weekly">Semanal</option>
                      <option value="biweekly">Quincenal</option>
                      <option value="monthly">Mensual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Etiqueta frecuencia</label>
                    <input type="text" value={form.frequency_label} onChange={e => setForm({ ...form, frequency_label: e.target.value })} placeholder="Cada 15 dias" className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Precio *</label>
                    <input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseInt(e.target.value) || 0 })} required className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Precio original</label>
                    <input type="number" value={form.original_price} onChange={e => setForm({ ...form, original_price: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Descuento</label>
                    <input type="text" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} placeholder="20%" className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Caracteristicas</label>
                  <div className="flex gap-2 mb-2">
                    <input type="text" value={featureInput} onChange={e => setFeatureInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }} placeholder="Envio gratis incluido" className="flex-1 px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
                    <button type="button" onClick={addFeature} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"><Plus className="h-4 w-4" /></button>
                  </div>
                  <div className="space-y-1.5">
                    {form.features.map((feat, i) => (
                      <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                        <span className="flex-1 text-sm text-foreground">{feat}</span>
                        <button type="button" onClick={() => removeFeature(i)} className="text-muted-foreground hover:text-destructive transition-colors text-xs">x</button>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={form.is_popular} onChange={e => setForm({ ...form, is_popular: e.target.checked })} className="rounded border-border" />
                  Marcar como &quot;Mas popular&quot;
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded border-border" />
                  Plan activo
                </label>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold">{editing ? 'Guardar' : 'Crear'}</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
