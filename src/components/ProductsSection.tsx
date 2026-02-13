import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ProductCard from './ProductCard';

interface DBProduct {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  origin: string | null;
  roast_level: number | null;
  sort_order: number | null;
}

interface DBVariant {
  id: string;
  product_id: string;
  weight: string;
  grind: string;
  price_modifier: number | null;
  stock: number | null;
}

export default function ProductsSection() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      const [productsRes, variantsRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('product_variants').select('*').eq('is_active', true),
      ]);

      const dbProducts = (productsRes.data as DBProduct[]) || [];
      const dbVariants = (variantsRes.data as DBVariant[]) || [];

      const mapped = dbProducts.map(p => {
        const pVariants = dbVariants.filter(v => v.product_id === p.id);
        const weights = Array.from(new Set(pVariants.map(v => v.weight))).map(w => ({ value: w }));
        const grinds = Array.from(new Set(pVariants.map(v => v.grind)));

        const stockMap: Record<string, number> = {};
        const priceMap: Record<string, number> = {};
        pVariants.forEach(v => {
          const key = `${v.weight}-${v.grind}`;
          stockMap[key] = v.stock ?? 0;
          priceMap[key] = (v.price_modifier ?? 0);
        });

        return {
          id: p.id,
          name: p.name,
          description: p.description || '',
          image: p.image_url || '/placeholder.svg',
          weights: weights.length > 0 ? weights : [{ value: '250g' }],
          grinds: grinds.length > 0 ? grinds : ['Grano', 'Molido'],
          roastLevel: p.roast_level || 3,
          origin: p.origin || '',
          stockMap,
          priceMap,
        };
      });

      setProducts(mapped);
      setLoading(false);
    };

    fetchProducts();
  }, []);

  return (
    <section id="productos" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold mb-4">
            Nuestra Selección
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Café de especialidad
          </h2>
          <p className="text-muted-foreground text-lg">
            Cada grano cuenta una historia. Descubre los sabores únicos de las diferentes regiones cafeteras de Colombia.
          </p>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground">Próximamente productos disponibles.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <div 
                key={product.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
