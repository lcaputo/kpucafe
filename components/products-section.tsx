'use client';

import { useState } from 'react';
import ProductCard from './product-card';

const COFFEE_CATEGORY_NAME = 'Cafe';

interface ProductsSectionProps {
  products: any[];
  categories: any[];
}

export default function ProductsSection({ products, categories }: ProductsSectionProps) {
  const [activeEquipCategory, setActiveEquipCategory] = useState<string | 'all'>('all');

  // Map Prisma camelCase data to the format ProductCard expects
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

  const coffeeCategory = categories.find((c: any) => c.name === COFFEE_CATEGORY_NAME);
  const coffeeCategoryId = coffeeCategory?.id;

  const coffeeProducts = mapped.filter((p: any) => p.categoryId === coffeeCategoryId);
  const equipCategories = categories.filter((c: any) => c.name !== COFFEE_CATEGORY_NAME);
  const equipProducts = mapped.filter((p: any) => p.categoryId !== coffeeCategoryId);

  const equipCategoriesWithProducts = equipCategories.filter((cat: any) =>
    equipProducts.some((p: any) => p.categoryId === cat.id),
  );
  const showEquipTabs = equipCategoriesWithProducts.length > 1;

  const filteredEquipProducts =
    activeEquipCategory === 'all'
      ? equipProducts
      : equipProducts.filter((p: any) => p.categoryId === activeEquipCategory);

  return (
    <>
      {/* Coffee Section */}
      <section id="productos" aria-label="Cafe de especialidad" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold mb-4">
              Nuestra Seleccion
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Cafe de especialidad
            </h2>
            <p className="text-muted-foreground text-lg">
              Cada grano cuenta una historia. Descubre los sabores unicos de las diferentes regiones
              cafeteras de Colombia.
            </p>
          </div>

          {coffeeProducts.length === 0 ? (
            <p className="text-center text-muted-foreground">Proximamente cafes disponibles.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {coffeeProducts.map((product: any, index: number) => (
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
      {equipProducts.length > 0 && (
        <section id="equipos" aria-label="Equipo y accesorios" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="inline-block px-4 py-2 bg-secondary/10 text-secondary rounded-full text-sm font-semibold mb-4">
                Equipo & Accesorios
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
                Todo para tu ritual cafetero
              </h2>
              <p className="text-muted-foreground text-lg">
                Las mejores herramientas para preparar tu cafe perfecto en casa.
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
                {equipCategoriesWithProducts.map((cat: any) => (
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
              {filteredEquipProducts.map((product: any, index: number) => (
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
