import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ProductCard from './ProductCard';

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface DBProduct {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  origin: string | null;
  roast_level: number | null;
  sort_order: number | null;
  category_id: string | null;
  has_variants: boolean;
}

interface DBVariant {
  id: string;
  product_id: string;
  weight: string;
  grind: string;
  price_modifier: number | null;
  stock: number | null;
}

const COFFEE_CATEGORY_NAME = 'Café';

export default function ProductsSection() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeEquipCategory, setActiveEquipCategory] = useState<string | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      const [productsRes, variantsRes, categoriesRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('product_variants').select('*').eq('is_active', true),
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      ]);

      const dbProducts = (productsRes.data as DBProduct[]) || [];
      const dbVariants = (variantsRes.data as DBVariant[]) || [];
      const dbCategories = (categoriesRes.data as Category[]) || [];

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
          categoryId: p.category_id,
          hasVariants: p.has_variants,
          basePrice: p.base_price,
        };
      });

      setProducts(mapped);
      setCategories(dbCategories);
      setLoading(false);
    };

    fetchProducts();
  }, []);

  const coffeeCategory = categories.find(c => c.name === COFFEE_CATEGORY_NAME);
  const coffeeCategoryId = coffeeCategory?.id;

  const coffeeProducts = products.filter(p => p.categoryId === coffeeCategoryId);
  const equipCategories = categories.filter(c => c.name !== COFFEE_CATEGORY_NAME);
  const equipProducts = products.filter(p => p.categoryId !== coffeeCategoryId);

  const equipCategoriesWithProducts = equipCategories.filter(cat =>
    equipProducts.some(p => p.categoryId === cat.id)
  );
  const showEquipTabs = equipCategoriesWithProducts.length > 1;

  const filteredEquipProducts = activeEquipCategory === 'all'
    ? equipProducts
    : equipProducts.filter(p => p.categoryId === activeEquipCategory);

  return (
    <>
      {/* Coffee Section */}
      <section id="productos" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
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

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : coffeeProducts.length === 0 ? (
            <p className="text-center text-muted-foreground">Próximamente cafés disponibles.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {coffeeProducts.map((product, index) => (
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

      {/* Equipment / Accessories Section */}
      {!loading && equipProducts.length > 0 && (
        <section id="equipos" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="inline-block px-4 py-2 bg-secondary/10 text-secondary rounded-full text-sm font-semibold mb-4">
                Equipo & Accesorios
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
                Todo para tu ritual cafetero
              </h2>
              <p className="text-muted-foreground text-lg">
                Las mejores herramientas para preparar tu café perfecto en casa.
              </p>
            </div>

            {showEquipTabs && (
              <div className="flex gap-2 justify-center flex-wrap mb-10">
                <button
                  onClick={() => setActiveEquipCategory('all')}
                  className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all ${
                    activeEquipCategory === 'all'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary hover:text-foreground'
                  }`}
                >
                  Todo
                </button>
                {equipCategoriesWithProducts.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveEquipCategory(cat.id)}
                    className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all ${
                      activeEquipCategory === cat.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary hover:text-foreground'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredEquipProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
