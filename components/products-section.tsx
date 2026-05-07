'use client';

import ProductCard from './product-card';
import { Sparkles } from 'lucide-react';

interface ProductsSectionProps {
  products: any[];
}

function mapProduct(p: any) {
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
}

export { mapProduct };

export default function ProductsSection({ products }: ProductsSectionProps) {
  const mapped = products.map(mapProduct);

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
              color: 'hsl(14 82% 40%)',
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

        {/* Products grid */}
        {mapped.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">☕</span>
            </div>
            <p className="text-muted-foreground font-medium">Proximamente productos disponibles.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mapped.map((product: any, index: number) => (
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
