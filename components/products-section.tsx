'use client';

import { useState } from 'react';
import ProductCard from './product-card';
import { Sparkles } from 'lucide-react';

interface ProductsSectionProps {
  products: any[];
  categories: any[];
}

export default function ProductsSection({ products, categories }: ProductsSectionProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | 'all'>('all');

  const mapped = products.map((p: any) => {
    const pVariants = p.variants || [];
    const weights = Array.from(new Set(pVariants.map((v: any) => v.weight))).map((w: any) => ({
      value: w,
    }));
    const grinds = Array.from(new Set(pVariants.map((v: any) => v.grind))) as string[];

    const stockMap: Record<string, number> = {};
    const priceMap: Record<string, number> = {};
    pVariants.forEach((v: any) => {
      const key = `${v.weight}-${v.grind}`;
      stockMap[key] = v.stock ?? 0;
      priceMap[key] = v.priceModifier ?? 0;
    });

    return {
      id: p.id,
      name: p.name,
      description: p.description || '',
      image: p.imageUrl || '/placeholder.svg',
      weights: weights.length > 0 ? weights : [{ value: '250g' }],
      grinds: grinds.length > 0 ? grinds : ['Grano', 'Molido'],
      roastLevel: p.roastLevel || 3,
      origin: p.origin || '',
      stockMap,
      priceMap,
      categoryId: p.categoryId,
      hasVariants: p.hasVariants,
      basePrice: p.basePrice,
    };
  });

  // Categories that actually have products
  const categoriesWithProducts = categories.filter((cat: any) =>
    mapped.some((p) => p.categoryId === cat.id),
  );

  // Uncategorized products
  const uncategorizedProducts = mapped.filter((p) => !p.categoryId);

  // All tabs: categories with products + "Sin categoria" if any
  const tabs = [
    ...categoriesWithProducts,
    ...(uncategorizedProducts.length > 0 ? [{ id: '__none__', name: 'Otros', icon: null }] : []),
  ];

  const effectiveTab = activeCategoryId;

  const visibleProducts =
    effectiveTab === 'all'
      ? mapped
      : effectiveTab === '__none__'
        ? uncategorizedProducts
        : mapped.filter((p) => p.categoryId === effectiveTab);

  const activeCategory = categories.find((c: any) => c.id === effectiveTab);

  const sectionTitle = activeCategory?.name ?? 'Cafe de especialidad';
  const sectionDescription = activeCategory?.description ?? null;

  return (
    <section id="productos" aria-label="Productos" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-5"
            style={{
              background: 'hsl(var(--primary) / 0.12)',
              border: '1px solid hsl(var(--primary) / 0.22)',
              color: 'hsl(var(--primary))',
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Nuestra Seleccion
          </div>
          <h2
            className="font-display text-foreground mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)' }}
          >
            Cafe de especialidad
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Cada grano cuenta una historia. Descubre los sabores unicos de las diferentes regiones
            cafeteras de Colombia.
          </p>
        </div>

        {/* Category tabs */}
        {tabs.length > 0 && (
          <div className="flex gap-2 justify-center flex-wrap mb-12">
            <button
              onClick={() => setActiveCategoryId('all')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-all duration-200 cursor-pointer min-h-[44px] ${
                effectiveTab === 'all'
                  ? 'bg-primary text-primary-foreground border-primary shadow-warm'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground bg-background'
              }`}
            >
              Todo
            </button>
            {tabs.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-all duration-200 cursor-pointer min-h-[44px] ${
                  effectiveTab === cat.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-warm'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground bg-background'
                }`}
              >
                {cat.icon && <span>{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Products grid */}
        {visibleProducts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">☕</span>
            </div>
            <p className="text-muted-foreground font-medium">Proximamente productos disponibles.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleProducts.map((product: any, index: number) => (
              <div
                key={product.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 0.08}s` }}
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
