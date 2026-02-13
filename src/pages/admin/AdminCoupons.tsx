import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Loader2, Ticket, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  current_uses: number | null;
  is_active: boolean | null;
  expires_at: string | null;
  created_at: string;
}

export default function AdminCoupons() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  const [form, setForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 10,
    min_order_amount: 0,
    max_uses: 0,
    is_active: true,
    expires_at: '',
  });

  useEffect(() => { fetchCoupons(); }, []);

  const fetchCoupons = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons((data as Coupon[]) || []);
    setLoading(false);
  };

  const openModal = (coupon?: Coupon) => {
    if (coupon) {
      setEditing(coupon);
      setForm({
        code: coupon.code,
        description: coupon.description || '',
        discount_type: coupon.discount_type as 'percentage' | 'fixed',
        discount_value: coupon.discount_value,
        min_order_amount: coupon.min_order_amount || 0,
        max_uses: coupon.max_uses || 0,
        is_active: coupon.is_active !== false,
        expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
      });
    } else {
      setEditing(null);
      setForm({ code: '', description: '', discount_type: 'percentage', discount_value: 10, min_order_amount: 0, max_uses: 0, is_active: true, expires_at: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: form.code.toUpperCase().trim(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      min_order_amount: form.min_order_amount || 0,
      max_uses: form.max_uses || null,
      is_active: form.is_active,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    };

    if (editing) {
      const { error } = await supabase.from('coupons').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Cupón actualizado' });
    } else {
      const { error } = await supabase.from('coupons').insert(payload);
      if (error) {
        if (error.message.includes('duplicate')) toast({ title: 'Error', description: 'Ya existe un cupón con ese código', variant: 'destructive' });
        else toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Cupón creado' });
    }
    fetchCoupons();
    closeModal();
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('¿Eliminar este cupón?')) return;
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Cupón eliminado' }); fetchCoupons(); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Código copiado' });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-bold text-foreground">Cupones</h2>
        <button onClick={() => openModal()} className="btn-kpu flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Nuevo Cupón
        </button>
      </div>

      {coupons.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl">
          <Ticket className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">No hay cupones</h3>
          <p className="text-muted-foreground mb-6">Crea tu primer cupón de descuento</p>
          <button onClick={() => openModal()} className="btn-kpu inline-flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Crear Cupón
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map(coupon => (
            <div key={coupon.id} className={`bg-card rounded-xl p-5 shadow-soft border-2 ${coupon.is_active ? 'border-primary/20' : 'border-border opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => copyCode(coupon.code)} className="font-mono text-lg font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                    {coupon.code}
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openModal(coupon)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => deleteCoupon(coupon.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {coupon.description && <p className="text-sm text-muted-foreground mb-3">{coupon.description}</p>}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descuento</span>
                  <span className="font-semibold text-foreground">
                    {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `$${coupon.discount_value.toLocaleString('es-CO')}`}
                  </span>
                </div>
                {(coupon.min_order_amount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mínimo</span>
                    <span className="text-foreground">${(coupon.min_order_amount || 0).toLocaleString('es-CO')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usos</span>
                  <span className="text-foreground">{coupon.current_uses || 0}{coupon.max_uses ? ` / ${coupon.max_uses}` : ' / ∞'}</span>
                </div>
                {coupon.expires_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expira</span>
                    <span className="text-foreground">{new Date(coupon.expires_at).toLocaleDateString('es-CO')}</span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${coupon.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {coupon.is_active ? 'Activo' : 'Inactivo'}
                </span>
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
              <h3 className="font-display text-xl font-bold text-foreground mb-6">
                {editing ? 'Editar Cupón' : 'Nuevo Cupón'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Código *</label>
                  <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required placeholder="BIENVENIDO20" className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary uppercase font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Descripción</label>
                  <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="20% en tu primera compra" className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
                    <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value as any })} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="percentage">Porcentaje (%)</option>
                      <option value="fixed">Monto fijo ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Valor *</label>
                    <input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: parseInt(e.target.value) || 0 })} required min="1" className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Compra mínima (COP)</label>
                    <input type="number" value={form.min_order_amount} onChange={e => setForm({ ...form, min_order_amount: parseInt(e.target.value) || 0 })} min="0" className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Máx. usos (0 = ilimitado)</label>
                    <input type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: parseInt(e.target.value) || 0 })} min="0" className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Fecha de expiración</label>
                  <input type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded border-border" />
                  Cupón activo
                </label>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold">
                    {editing ? 'Guardar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
