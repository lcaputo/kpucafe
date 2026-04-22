'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Loader2, Coffee, Upload, X, Image as ImageIcon, ArrowUp, ArrowDown, GripVertical, Package, Tag } from 'lucide-react';
import NextImage from 'next/image';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import ProductVariantsManager from '@/components/admin/product-variants-manager';

interface Category {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  origin: string | null;
  roast_level: number | null;
  is_active: boolean;
  sort_order: number;
  category_id: string | null;
  has_variants: boolean;
}

interface ProductVariant {
  id: string;
  product_id: string;
  weight: string;
  grind: string;
  price_modifier: number;
  stock: number;
}

export default function AdminProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [variantsProductId, setVariantsProductId] = useState<string | null>(null);
  const [variantsProductName, setVariantsProductName] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    origin: '',
    roast_level: 3,
    category_id: '' as string,
    has_variants: true,
    base_price: 0,
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/products'),
        fetch('/api/categories'),
      ]);
      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();

      const mappedProducts = (productsData as any[]).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        base_price: p.basePrice,
        image_url: p.imageUrl,
        origin: p.origin,
        roast_level: p.roastLevel,
        is_active: p.isActive,
        sort_order: p.sortOrder ?? 0,
        category_id: p.categoryId,
        has_variants: p.hasVariants,
      }));
      const mappedCategories = (categoriesData as any[]).map((c: any) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        sort_order: c.sortOrder,
        is_active: c.isActive,
      }));
      const allVariants: ProductVariant[] = [];
      for (const p of productsData as any[]) {
        if (p.variants) {
          for (const v of p.variants) {
            allVariants.push({
              id: v.id,
              product_id: v.productId,
              weight: v.weight,
              grind: v.grind,
              price_modifier: v.priceModifier,
              stock: v.stock,
            });
          }
        }
      }
      setProducts(mappedProducts);
      setVariants(allVariants);
      setCategories(mappedCategories);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const filteredProducts = filterCategoryId === 'all'
    ? products
    : filterCategoryId === '__none__'
      ? products.filter(p => !p.category_id)
      : products.filter(p => p.category_id === filterCategoryId);

  const moveProduct = async (index: number, direction: 'up' | 'down') => {
    const displayList = filteredProducts;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= displayList.length) return;

    const updated = [...products];
    const globalIndexA = products.findIndex(p => p.id === displayList[index].id);
    const globalIndexB = products.findIndex(p => p.id === displayList[newIndex].id);
    [updated[globalIndexA], updated[globalIndexB]] = [updated[globalIndexB], updated[globalIndexA]];

    try {
      await fetch('/api/admin/products/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: updated.map(p => p.id) }),
      });
      setProducts(updated.map((p, i) => ({ ...p, sort_order: i })));
      toast({ title: 'Orden actualizado' });
    } catch {
      toast({ title: 'Error al reordenar', variant: 'destructive' });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Solo se permiten imagenes', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'La imagen no debe superar 5MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/uploads/product-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setFormData(prev => ({ ...prev, image_url: data.url }));
      setImagePreview(data.url);
      toast({ title: 'Imagen subida correctamente' });
    } catch (err: any) {
      toast({ title: 'Error al subir imagen', description: err.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, image_url: '' }));
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      description: formData.description,
      imageUrl: formData.image_url,
      origin: formData.origin,
      roastLevel: formData.roast_level,
      categoryId: formData.category_id || null,
      hasVariants: formData.has_variants,
      basePrice: formData.has_variants ? 0 : formData.base_price,
    };

    try {
      if (editingProduct) {
        const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
        toast({ title: 'Producto actualizado' }); fetchAll(); closeModal();
      } else {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, sortOrder: products.length }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
        const data = await res.json();
        if (formData.has_variants) {
          await fetch(`/api/admin/products/${data.id}/variants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              variants: [
                { weight: '250g', grind: 'Grano', priceModifier: 35000 },
                { weight: '250g', grind: 'Molido', priceModifier: 35000 },
                { weight: '500g', grind: 'Grano', priceModifier: 60000 },
                { weight: '500g', grind: 'Molido', priceModifier: 60000 },
                { weight: '1kg', grind: 'Grano', priceModifier: 90000 },
                { weight: '1kg', grind: 'Molido', priceModifier: 90000 },
              ],
            }),
          });
        }
        toast({ title: 'Producto creado' }); fetchAll(); closeModal();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Estas seguro de eliminar este producto?')) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Producto eliminado' }); fetchAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        image_url: product.image_url || '',
        origin: product.origin || '',
        roast_level: product.roast_level || 3,
        category_id: product.category_id || '',
        has_variants: product.has_variants,
        base_price: product.base_price || 0,
      });
      setImagePreview(product.image_url || null);
    } else {
      setEditingProduct(null);
      setFormData({ name: '', description: '', image_url: '', origin: '', roast_level: 3, category_id: '', has_variants: true, base_price: 0 });
      setImagePreview(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find(c => c.id === categoryId)?.name || null;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      {/* Category filter tabs + action */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <div className="flex gap-2 flex-wrap flex-1">
        <button
          onClick={() => setFilterCategoryId('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${filterCategoryId === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
        >
          Todos ({products.length})
        </button>
        {categories.map(cat => {
          const count = products.filter(p => p.category_id === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setFilterCategoryId(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${filterCategoryId === cat.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
            >
              {cat.name} ({count})
            </button>
          );
        })}
        <button
          onClick={() => setFilterCategoryId('__none__')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${filterCategoryId === '__none__' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
        >
          Sin categoria ({products.filter(p => !p.category_id).length})
        </button>
        </div>
        <button onClick={() => openModal()} className="btn-kpu flex items-center gap-2 flex-shrink-0"><Plus className="h-4 w-4" />Nuevo Producto</button>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-2xl">
          <Coffee className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">No hay productos</h3>
          <p className="text-muted-foreground text-sm">Agrega tu primer producto</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-soft overflow-hidden">
          {filteredProducts.map((product, index) => {
            const productVariants = variants.filter(v => v.product_id === product.id);
            const categoryName = getCategoryName(product.category_id);
            const isExpanded = expandedId === product.id;

            return (
              <div key={product.id} className={`border-b border-border last:border-0 ${isExpanded ? 'bg-muted/20' : ''}`}>
                {/* Row — clickable anywhere to expand */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : product.id)}
                >
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
                    <button onClick={() => moveProduct(index, 'up')} disabled={index === 0} className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />
                    <button onClick={() => moveProduct(index, 'down')} disabled={index === filteredProducts.length - 1} className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>

                  {/* Image */}
                  {product.image_url ? (
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <NextImage src={product.image_url} alt={product.name} fill sizes="48px" className="rounded-lg object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                      <Coffee className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{product.name}</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {product.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                      {categoryName && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <Tag className="h-3 w-3" />{categoryName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {product.origin && <span>{product.origin}</span>}
                      {product.origin && <span>·</span>}
                      {product.has_variants
                        ? <span>{productVariants.length} variantes</span>
                        : <span>${product.base_price.toLocaleString('es-CO')} COP</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <Switch
                      checked={product.is_active}
                      onCheckedChange={async (checked) => {
                        try {
                          await fetch(`/api/admin/products/${product.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ isActive: checked }),
                          });
                          setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: checked } : p));
                          toast({ title: checked ? 'Producto activado' : 'Producto desactivado' });
                        } catch {
                          toast({ title: 'Error al cambiar estado', variant: 'destructive' });
                        }
                      }}
                    />
                    {product.has_variants && (
                      <button onClick={() => { setVariantsProductId(product.id); setVariantsProductName(product.name); }} className="p-2 text-muted-foreground hover:text-primary transition-colors" title="Variantes">
                        <Package className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => openModal(product)} className="p-2 text-muted-foreground hover:text-primary transition-colors"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => deleteProduct(product.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                {/* Accordion panel */}
                {isExpanded && (
                  <div className="px-6 pb-5 pt-1 border-t border-border bg-background">
                    <div className="grid sm:grid-cols-2 gap-4 mt-3 text-sm">
                      {product.description && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Descripción</p>
                          <p className="text-foreground leading-relaxed">{product.description}</p>
                        </div>
                      )}
                      {product.has_variants && productVariants.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Variantes</p>
                          <div className="space-y-1">
                            {productVariants.map(v => (
                              <div key={v.id} className="flex justify-between items-center bg-muted/50 rounded-lg px-3 py-1.5">
                                <span className="text-foreground">{v.weight} · {v.grind}</span>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>${v.price_modifier.toLocaleString('es-CO')}</span>
                                  <span className={v.stock > 0 ? 'text-green-600' : 'text-red-500'}>
                                    {v.stock > 0 ? `${v.stock} und.` : 'Agotado'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {!product.description && !product.has_variants && (
                        <p className="text-muted-foreground text-sm col-span-2">Sin detalles adicionales.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sidebar Drawer */}
      {isModalOpen && (
        <>
          <div className="fixed inset-0 bg-foreground/50 z-50" onClick={closeModal} />
          <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-card z-50 shadow-2xl flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border flex-shrink-0">
              <h3 className="font-display text-xl font-bold text-foreground">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6">
              <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Imagen del Producto</label>
                  {imagePreview ? (
                    <div className="relative w-full h-52 rounded-xl overflow-hidden bg-muted group">
                      <NextImage src={imagePreview} alt="Vista previa del producto" fill sizes="512px" className="object-cover" />
                      <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 bg-card rounded-full text-foreground hover:bg-muted transition-colors"><Upload className="h-5 w-5" /></button>
                        <button type="button" onClick={removeImage} className="p-2 bg-card rounded-full text-destructive hover:bg-muted transition-colors"><X className="h-5 w-5" /></button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full h-52 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 flex flex-col items-center justify-center gap-2 transition-colors">
                      {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : (<><ImageIcon className="h-8 w-8 text-muted-foreground" /><span className="text-sm text-muted-foreground">Haz clic para subir una imagen</span><span className="text-xs text-muted-foreground">JPG, PNG, WebP — max 5MB</span></>)}
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Nombre <span className="text-destructive">*</span></label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
                  <select
                    value={formData.category_id}
                    onChange={e => {
                      const catId = e.target.value;
                      const selectedCat = categories.find(c => c.id === catId);
                      const isCoffee = selectedCat?.name === 'Cafe' || selectedCat?.name === 'Café';
                      setFormData({ ...formData, category_id: catId, has_variants: isCoffee });
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Sin categoria</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-xl border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Tiene variantes (peso/molienda)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Activa para cafe. Desactiva para equipos con precio fijo.</p>
                  </div>
                  <Switch checked={formData.has_variants} onCheckedChange={checked => setFormData({ ...formData, has_variants: checked })} />
                </div>

                {!formData.has_variants && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Precio (COP) <span className="text-destructive">*</span></label>
                    <input type="number" value={formData.base_price} onChange={e => setFormData({ ...formData, base_price: parseInt(e.target.value) || 0 })} required min={0} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Descripcion</label>
                  <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Origen / Modelo</label>
                  <input type="text" value={formData.origin} onChange={e => setFormData({ ...formData, origin: e.target.value })} placeholder="Huila, Narino, Hario V60..." className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>

                {formData.has_variants && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Nivel de Tostado — <span className="text-primary font-semibold">{['', 'Suave', 'Medio-Suave', 'Medio', 'Medio-Fuerte', 'Fuerte'][formData.roast_level]}</span>
                    </label>
                    <input type="range" min="1" max="5" value={formData.roast_level} onChange={e => setFormData({ ...formData, roast_level: parseInt(e.target.value) })} className="w-full accent-primary" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Suave</span><span>Medio</span><span>Fuerte</span></div>
                  </div>
                )}
              </form>
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-border flex-shrink-0 flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-border rounded-xl text-foreground hover:bg-muted transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="product-form"
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold"
              >
                {editingProduct ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </>
      )}
      {variantsProductId && (
        <ProductVariantsManager
          productId={variantsProductId}
          productName={variantsProductName}
          onClose={() => { setVariantsProductId(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
