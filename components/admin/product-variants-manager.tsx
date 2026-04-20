'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Save, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProductVariant {
  id: string;
  product_id: string;
  weight: string;
  grind: string;
  price_modifier: number;
  stock: number;
  is_active: boolean;
}

interface Props {
  productId: string;
  productName: string;
  onClose: () => void;
}

const WEIGHTS = ['250g', '500g', '1kg'];
const GRINDS = ['Grano', 'Molido'];

export default function ProductVariantsManager({ productId, productName, onClose }: Props) {
  const { toast } = useToast();
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchVariants(); }, [productId]);

  const fetchVariants = async () => {
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants`);
      const data = await res.json();
      setVariants((data as any[]).map((v: any) => ({
        id: v.id,
        product_id: v.productId,
        weight: v.weight,
        grind: v.grind,
        price_modifier: v.priceModifier,
        stock: v.stock,
        is_active: v.isActive,
      })));
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const addVariant = () => {
    const usedCombos = new Set(variants.map(v => `${v.weight}-${v.grind}`));
    let weight = '';
    let grind = '';
    for (const w of WEIGHTS) {
      for (const g of GRINDS) {
        if (!usedCombos.has(`${w}-${g}`)) {
          weight = w;
          grind = g;
          break;
        }
      }
      if (weight) break;
    }
    if (!weight) {
      toast({ title: 'Todas las combinaciones ya existen', variant: 'destructive' });
      return;
    }
    setVariants(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        product_id: productId,
        weight,
        grind,
        price_modifier: 0,
        stock: 100,
        is_active: true,
      },
    ]);
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    setVariants(prev => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const removeVariant = async (index: number) => {
    const variant = variants[index];
    if (!variant.id.startsWith('new-')) {
      try {
        const res = await fetch(`/api/admin/variants/${variant.id}`, { method: 'DELETE' });
        if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      } catch (err: any) {
        toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' });
        return;
      }
    }
    setVariants(prev => prev.filter((_, i) => i !== index));
    toast({ title: 'Variante eliminada' });
  };

  const saveAll = async () => {
    setSaving(true);
    const newVariants = variants.filter(v => v.id.startsWith('new-'));
    const existingVariants = variants.filter(v => !v.id.startsWith('new-'));

    try {
      if (newVariants.length > 0) {
        await fetch(`/api/admin/products/${productId}/variants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variants: newVariants.map(v => ({
              weight: v.weight,
              grind: v.grind,
              priceModifier: v.price_modifier,
              stock: v.stock,
              isActive: v.is_active,
            })),
          }),
        });
      }

      for (const v of existingVariants) {
        await fetch(`/api/admin/variants/${v.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weight: v.weight,
            grind: v.grind,
            priceModifier: v.price_modifier,
            stock: v.stock,
            isActive: v.is_active,
          }),
        });
      }

      toast({ title: 'Variantes guardadas correctamente' });
      await fetchVariants();
    } catch (err: any) {
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-foreground/50 z-50" onClick={onClose} />
      <div className="fixed inset-x-2 sm:inset-x-4 top-1/2 -translate-y-1/2 max-w-2xl mx-auto bg-card rounded-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-foreground">Variantes</h3>
              <p className="text-sm text-muted-foreground">{productName}</p>
            </div>
            <button onClick={addVariant} className="btn-kpu flex items-center gap-2 text-sm px-3 py-2">
              <Plus className="h-4 w-4" /><span className="hidden sm:inline">Agregar</span>
            </button>
          </div>

          {variants.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No hay variantes. Agrega una para comenzar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_100px_80px_60px_40px] gap-2 text-xs font-semibold text-muted-foreground px-2">
                <span>Peso</span>
                <span>Molienda</span>
                <span>Precio (COP)</span>
                <span>Stock</span>
                <span>Activo</span>
                <span></span>
              </div>

              {variants.map((variant, index) => (
                <div key={variant.id} className="bg-muted/30 rounded-xl p-3 sm:p-2 sm:grid sm:grid-cols-[1fr_1fr_100px_80px_60px_40px] sm:items-center gap-2 space-y-3 sm:space-y-0">
                  <div>
                    <label className="text-xs text-muted-foreground sm:hidden mb-1 block">Peso</label>
                    <select value={variant.weight} onChange={e => updateVariant(index, 'weight', e.target.value)}
                      className="w-full px-3 py-2 sm:py-1.5 rounded-lg border border-input bg-background text-foreground text-sm">
                      {WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground sm:hidden mb-1 block">Molienda</label>
                    <select value={variant.grind} onChange={e => updateVariant(index, 'grind', e.target.value)}
                      className="w-full px-3 py-2 sm:py-1.5 rounded-lg border border-input bg-background text-foreground text-sm">
                      {GRINDS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground sm:hidden mb-1 block">Precio (COP)</label>
                    <input type="number" value={variant.price_modifier} onChange={e => updateVariant(index, 'price_modifier', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 sm:py-1.5 rounded-lg border border-input bg-background text-foreground text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground sm:hidden mb-1 block">Stock</label>
                    <input type="number" value={variant.stock} onChange={e => updateVariant(index, 'stock', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 sm:py-1.5 rounded-lg border border-input bg-background text-foreground text-sm" />
                  </div>
                  <div className="flex items-center gap-2 sm:justify-center">
                    <label className="text-xs text-muted-foreground sm:hidden">Activo</label>
                    <input type="checkbox" checked={variant.is_active} onChange={e => updateVariant(index, 'is_active', e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary accent-primary" />
                  </div>
                  <div className="flex justify-end sm:justify-center">
                    <button onClick={() => removeVariant(index)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-6">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition-colors">
              Cerrar
            </button>
            <button onClick={saveAll} disabled={saving}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold flex items-center justify-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Todo
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
