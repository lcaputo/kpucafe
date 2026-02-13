import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Loader2, Coffee, Upload, X, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  origin: string | null;
  roast_level: number | null;
  is_active: boolean;
}

interface ProductVariant {
  id: string;
  product_id: string;
  weight: string;
  grind: string;
  price_modifier: number;
  stock: number;
}

export default function AdminProducts() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_price: 0,
    image_url: '',
    origin: '',
    roast_level: 3,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const [productsRes, variantsRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('product_variants').select('*'),
    ]);
    setProducts(productsRes.data || []);
    setVariants(variantsRes.data || []);
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Solo se permiten imágenes', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'La imagen no debe superar 5MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) {
      toast({ title: 'Error al subir imagen', description: error.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    setFormData(prev => ({ ...prev, image_url: urlData.publicUrl }));
    setImagePreview(urlData.publicUrl);
    setUploading(false);
    toast({ title: 'Imagen subida correctamente' });
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, image_url: '' }));
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      const { error } = await supabase.from('products').update(formData).eq('id', editingProduct.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Producto actualizado' });
        fetchProducts();
        closeModal();
      }
    } else {
      const { data, error } = await supabase.from('products').insert(formData).select().single();
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        await supabase.from('product_variants').insert([
          { product_id: data.id, weight: '250g', grind: 'Grano', price_modifier: 0 },
          { product_id: data.id, weight: '250g', grind: 'Molido', price_modifier: 0 },
          { product_id: data.id, weight: '500g', grind: 'Grano', price_modifier: 25000 },
          { product_id: data.id, weight: '500g', grind: 'Molido', price_modifier: 25000 },
          { product_id: data.id, weight: '1kg', grind: 'Grano', price_modifier: 55000 },
          { product_id: data.id, weight: '1kg', grind: 'Molido', price_modifier: 55000 },
        ]);
        toast({ title: 'Producto creado' });
        fetchProducts();
        closeModal();
      }
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Producto eliminado' });
      fetchProducts();
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        base_price: product.base_price,
        image_url: product.image_url || '',
        origin: product.origin || '',
        roast_level: product.roast_level || 3,
      });
      setImagePreview(product.image_url || null);
    } else {
      setEditingProduct(null);
      setFormData({ name: '', description: '', base_price: 35000, image_url: '', origin: '', roast_level: 3 });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-bold text-foreground">Productos</h2>
        <button onClick={() => openModal()} className="btn-kpu flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Nuevo Producto
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl">
          <Coffee className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">No hay productos</h3>
          <p className="text-muted-foreground mb-6">Agrega tu primer producto de café</p>
          <button onClick={() => openModal()} className="btn-kpu inline-flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Agregar Producto
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 sm:px-6 py-4 text-sm font-semibold text-foreground">Producto</th>
                  <th className="text-left px-4 sm:px-6 py-4 text-sm font-semibold text-foreground hidden md:table-cell">Origen</th>
                  <th className="text-left px-4 sm:px-6 py-4 text-sm font-semibold text-foreground">Precio</th>
                  <th className="text-left px-4 sm:px-6 py-4 text-sm font-semibold text-foreground hidden sm:table-cell">Variantes</th>
                  <th className="text-left px-4 sm:px-6 py-4 text-sm font-semibold text-foreground hidden sm:table-cell">Estado</th>
                  <th className="text-right px-4 sm:px-6 py-4 text-sm font-semibold text-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map(product => {
                  const productVariants = variants.filter(v => v.product_id === product.id);
                  return (
                    <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                              <Coffee className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-foreground">{product.name}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1 hidden sm:block">{product.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-foreground hidden md:table-cell">{product.origin || '-'}</td>
                      <td className="px-4 sm:px-6 py-4 text-foreground">${product.base_price.toLocaleString('es-CO')}</td>
                      <td className="px-4 sm:px-6 py-4 text-foreground hidden sm:table-cell">{productVariants.length}</td>
                      <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          product.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {product.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openModal(product)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteProduct(product.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <>
          <div className="fixed inset-0 bg-foreground/50 z-50" onClick={closeModal} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-card rounded-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="font-display text-xl font-bold text-foreground mb-6">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Image upload */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Imagen del Producto</label>
                  {imagePreview ? (
                    <div className="relative w-full h-48 rounded-xl overflow-hidden bg-muted group">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 bg-card rounded-full text-foreground hover:bg-muted transition-colors"
                        >
                          <Upload className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={removeImage}
                          className="p-2 bg-card rounded-full text-destructive hover:bg-muted transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full h-48 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 flex flex-col items-center justify-center gap-2 transition-colors"
                    >
                      {uploading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      ) : (
                        <>
                          <Image className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Haz clic para subir una imagen</span>
                          <span className="text-xs text-muted-foreground">JPG, PNG, WebP · máx 5MB</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Descripción</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Precio Base (COP)</label>
                    <input type="number" value={formData.base_price} onChange={(e) => setFormData({ ...formData, base_price: parseInt(e.target.value) })} required className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Origen</label>
                    <input type="text" value={formData.origin} onChange={(e) => setFormData({ ...formData, origin: e.target.value })} placeholder="Huila, Nariño..." className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Nivel de Tostado (1-5)</label>
                  <input type="range" min="1" max="5" value={formData.roast_level} onChange={(e) => setFormData({ ...formData, roast_level: parseInt(e.target.value) })} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Suave</span><span>Medio</span><span>Fuerte</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold">
                    {editingProduct ? 'Guardar' : 'Crear'}
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
