'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Edit, Trash2, Loader2, Tag, X,
  ArrowUp, ArrowDown, GripVertical, LayoutGrid,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  product_count: number;
}

const EMPTY_FORM = { name: '', description: '', icon: '', is_active: true };

export default function AdminCategoriasPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      setCategories(
        (data as any[]).map(c => ({
          id: c.id,
          name: c.name,
          description: c.description,
          icon: c.icon,
          sort_order: c.sortOrder ?? 0,
          is_active: c.isActive,
          product_count: c._count?.products ?? 0,
        }))
      );
    } catch {
      toast({ title: 'Error al cargar categorias', variant: 'destructive' });
    }
    setLoading(false);
  };

  const openDrawer = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat);
      setFormData({
        name: cat.name,
        description: cat.description ?? '',
        icon: cat.icon ?? '',
        is_active: cat.is_active,
      });
    } else {
      setEditingCategory(null);
      setFormData(EMPTY_FORM);
    }
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingCategory(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      description: formData.description || null,
      icon: formData.icon || null,
      isActive: formData.is_active,
    };

    try {
      if (editingCategory) {
        const res = await fetch(`/api/admin/categories/${editingCategory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
        toast({ title: 'Categoria actualizada' });
      } else {
        const res = await fetch('/api/admin/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
        toast({ title: 'Categoria creada' });
      }
      fetchCategories();
      closeDrawer();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const deleteCategory = async (cat: Category) => {
    if (!confirm(`Eliminar la categoria "${cat.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Categoria eliminada' });
      fetchCategories();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const toggleActive = async (cat: Category, checked: boolean) => {
    try {
      await fetch(`/api/admin/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: checked }),
      });
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: checked } : c));
      toast({ title: checked ? 'Categoria activada' : 'Categoria desactivada' });
    } catch {
      toast({ title: 'Error al cambiar estado', variant: 'destructive' });
    }
  };

  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;
    const updated = [...categories];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setCategories(updated.map((c, i) => ({ ...c, sort_order: i })));
    try {
      await fetch('/api/admin/categories/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: updated.map(c => c.id) }),
      });
      toast({ title: 'Orden actualizado' });
    } catch {
      toast({ title: 'Error al reordenar', variant: 'destructive' });
      fetchCategories();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Header action */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-muted-foreground">{categories.length} categorias en total</p>
        <button onClick={() => openDrawer()} className="btn-kpu flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nueva Categoria
        </button>
      </div>

      {/* List */}
      {categories.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-2xl">
          <LayoutGrid className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">No hay categorias</h3>
          <p className="text-muted-foreground text-sm">Crea tu primera categoria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat, index) => (
            <div
              key={cat.id}
              className="bg-card rounded-xl shadow-soft p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              {/* Reorder controls */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveCategory(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <GripVertical className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                <button
                  onClick={() => moveCategory(index, 'down')}
                  disabled={index === categories.length - 1}
                  className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-lg">
                {cat.icon ? cat.icon : <Tag className="h-5 w-5 text-primary" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">{cat.name}</p>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      cat.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {cat.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
                  {cat.description && <span className="truncate max-w-xs">{cat.description}</span>}
                  {cat.description && <span>&bull;</span>}
                  <span>{cat.product_count} producto{cat.product_count !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch
                  checked={cat.is_active}
                  onCheckedChange={checked => toggleActive(cat, checked)}
                  title={cat.is_active ? 'Desactivar' : 'Activar'}
                />
                <button
                  onClick={() => openDrawer(cat)}
                  className="p-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteCategory(cat)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                  disabled={cat.product_count > 0}
                  title={cat.product_count > 0 ? 'Tiene productos asignados' : 'Eliminar'}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sidebar Drawer */}
      {isDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-foreground/50 z-50" onClick={closeDrawer} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card z-50 shadow-2xl flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border flex-shrink-0">
              <h3 className="font-display text-xl font-bold text-foreground">
                {editingCategory ? 'Editar Categoria' : 'Nueva Categoria'}
              </h3>
              <button
                type="button"
                onClick={closeDrawer}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6">
              <form id="category-form" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Nombre <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="ej. Café, Equipos, Accesorios"
                    className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Descripcion
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Descripcion breve de la categoria..."
                    className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Icono (emoji)
                  </label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="☕"
                    maxLength={4}
                    className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-2xl"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Un emoji que represente la categoria</p>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-xl border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Categoria activa</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Las categorias inactivas no aparecen en la tienda
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </form>
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-border flex-shrink-0 flex gap-3">
              <button
                type="button"
                onClick={closeDrawer}
                className="flex-1 py-2.5 border border-border rounded-xl text-foreground hover:bg-muted transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="category-form"
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold"
              >
                {editingCategory ? 'Guardar cambios' : 'Crear categoria'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
