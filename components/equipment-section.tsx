'use client';

import { useState } from 'react';
import ProductCard from './product-card';
import { mapProduct } from './products-section';
import { Coffee } from 'lucide-react';

interface EquipmentSectionProps {
  products: any[];
  categories: any[];
}

export default function EquipmentSection({ products, categories }: EquipmentSectionProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | 'all'>('all');

  const mapped = products.map(mapProduct);

  const categoriesWithProducts = categories.filter((cat: any) =>
    mapped.some((p) => p.categoryId === cat.id),
  );

  const visibleProducts =
    activeCategoryId === 'all'
      ? mapped
      : mapped.filter((p) => p.categoryId === activeCategoryId);

  if (mapped.length === 0) return null;

  return (
    <section id="equipo" aria-label="Equipo y Accesorios" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-5"
            style={{
              background: 'hsl(var(--foreground) / 0.06)',
              border: '1px solid hsl(var(--foreground) / 0.12)',
              color: 'hsl(var(--foreground))',
            }}
          >
            Equipo &amp; Accesorios
          </div>
          <h2
            className="font-display text-foreground mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)' }}
          >
            Todo para tu ritual cafetero
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Las mejores herramientas para preparar tu cafe perfecto en casa.
          </p>
        </div>

        {/* Category tabs */}
        {categoriesWithProducts.length > 1 && (
          <div className="flex gap-2 justify-center flex-wrap mb-12">
            <button
              onClick={() => setActiveCategoryId('all')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-all duration-200 cursor-pointer min-h-[44px] ${
                activeCategoryId === 'all'
                  ? 'bg-[hsl(14_82%_40%)] text-white border-[hsl(14_82%_40%)] shadow-warm'
                  : 'border-border text-foreground hover:border-primary/50 bg-background'
              }`}
            >
              Todo
            </button>
            {categoriesWithProducts.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-all duration-200 cursor-pointer min-h-[44px] ${
                  activeCategoryId === cat.id
                    ? 'bg-[hsl(14_82%_40%)] text-white border-[hsl(14_82%_40%)] shadow-warm'
                    : 'border-border text-foreground hover:border-primary/50 bg-background'
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
              <Coffee className="h-8 w-8 text-muted-foreground/40" />
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
