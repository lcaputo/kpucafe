'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ShoppingBag, Check, Star } from 'lucide-react';
import { useCart } from '@/components/providers';

interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  weights: { value: string }[];
  grinds: string[];
  roastLevel: number;
  origin: string;
  stockMap?: Record<string, number>;
  priceMap?: Record<string, number>;
  hasVariants?: boolean;
  basePrice?: number;
}

interface ProductCardProps {
  product: Product;
}

const ROAST_LABELS = ['', 'Suave', 'Suave-Medio', 'Medio', 'Medio-Fuerte', 'Fuerte'];

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem, setIsCartOpen } = useCart();
  const hasVariants = product.hasVariants !== false;

  const getStock = (w: string, g: string) => product.stockMap?.[`${w}-${g}`] ?? 1;

  const findInitialSelection = () => {
    for (const grind of product.grinds) {
      for (const weight of product.weights) {
        if (getStock(weight.value, grind) > 0) return { grind, weight };
      }
    }
    return { grind: product.grinds[0], weight: product.weights[0] };
  };

  const initial = findInitialSelection();
  const [selectedGrind, setSelectedGrind] = useState(initial.grind);
  const [selectedWeight, setSelectedWeight] = useState(initial.weight);
  const [isAdded, setIsAdded] = useState(false);

  const handleGrindChange = (grind: string) => {
    setSelectedGrind(grind);
    if (getStock(selectedWeight.value, grind) <= 0) {
      const available = product.weights.find((w) => getStock(w.value, grind) > 0);
      if (available) setSelectedWeight(available);
    }
  };

  const handleWeightChange = (weight: (typeof product.weights)[0]) => {
    setSelectedWeight(weight);
    if (getStock(weight.value, selectedGrind) <= 0) {
      const available = product.grinds.find((g) => getStock(weight.value, g) > 0);
      if (available) setSelectedGrind(available);
    }
  };

  const currentPrice = hasVariants
    ? (product.priceMap?.[`${selectedWeight.value}-${selectedGrind}`] ?? 0)
    : (product.basePrice ?? 0);
  const currentStock = hasVariants ? getStock(selectedWeight.value, selectedGrind) : 1;
  const isOutOfStock = currentStock <= 0;

  const handleAddToCart = () => {
    addItem({
      id: hasVariants ? `${product.id}-${selectedWeight.value}-${selectedGrind}` : product.id,
      name: product.name,
      price: currentPrice,
      image: product.image,
      weight: hasVariants ? selectedWeight.value : 'Unidad',
      grind: hasVariants ? selectedGrind : '-',
    });

    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
      setIsCartOpen(true);
    }, 600);
  };

  return (
    <article className="card-product group flex flex-col h-full">
      {/* Image */}
      <div className="relative overflow-hidden aspect-[4/3] bg-muted flex-shrink-0">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {product.origin && (
          <div className="absolute top-3 left-3">
            <span
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{
                background: 'hsl(var(--primary) / 0.9)',
                color: 'hsl(var(--primary-foreground))',
                backdropFilter: 'blur(8px)',
              }}
            >
              {product.origin}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display text-2xl font-bold text-foreground mb-1.5 leading-tight">
          {product.name}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-2">
          {product.description}
        </p>

        {/* Roast level */}
        {hasVariants && (
          <div className="flex items-center gap-2.5 mb-4">
            <span className="text-xs text-muted-foreground font-medium">Tostado:</span>
            <div className="flex gap-1" aria-label={`Nivel de tostado: ${ROAST_LABELS[product.roastLevel]}`}>
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    level <= product.roastLevel
                      ? 'bg-primary'
                      : 'bg-muted-foreground/25'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{ROAST_LABELS[product.roastLevel]}</span>
          </div>
        )}

        {hasVariants && (
          <div className="space-y-3 mb-5">
            {/* Grind */}
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                Tipo
              </span>
              <div className="flex flex-wrap gap-1.5">
                {product.grinds.map((grind) => {
                  const allOut = product.weights.every((w) => getStock(w.value, grind) <= 0);
                  return (
                    <button
                      key={grind}
                      onClick={() => handleGrindChange(grind)}
                      disabled={allOut}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 cursor-pointer min-h-[36px] ${
                        allOut
                          ? 'border-border/50 text-muted-foreground/40 line-through cursor-not-allowed'
                          : selectedGrind === grind
                          ? 'border-primary bg-primary text-primary-foreground shadow-warm'
                          : 'border-border text-foreground hover:border-primary/60 hover:bg-primary/5'
                      }`}
                    >
                      {grind}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weight */}
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                Presentacion
              </span>
              <div className="flex flex-wrap gap-1.5">
                {product.weights.map((weight) => {
                  const weightOut = getStock(weight.value, selectedGrind) <= 0;
                  return (
                    <button
                      key={weight.value}
                      onClick={() => handleWeightChange(weight)}
                      disabled={weightOut}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 cursor-pointer min-h-[36px] ${
                        weightOut
                          ? 'border-border/50 text-muted-foreground/40 line-through cursor-not-allowed'
                          : selectedWeight.value === weight.value
                          ? 'border-primary bg-primary text-primary-foreground shadow-warm'
                          : 'border-border text-foreground hover:border-primary/60 hover:bg-primary/5'
                      }`}
                    >
                      {weight.value}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!hasVariants && <div className="mb-5 flex-1" />}

        {/* Price & Add to Cart */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/60">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-display text-foreground">
                ${currentPrice.toLocaleString('es-CO')}
              </span>
              <span className="text-muted-foreground text-xs font-medium">COP</span>
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isAdded || isOutOfStock}
            aria-label={isOutOfStock ? 'Producto agotado' : `Agregar ${product.name} al carrito`}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 cursor-pointer min-h-[44px] ${
              isOutOfStock
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : isAdded
                ? 'bg-green-500 text-white scale-95'
                : 'bg-primary text-primary-foreground hover:shadow-warm hover:scale-[1.04] active:scale-95'
            }`}
          >
            {isOutOfStock ? (
              'Agotado'
            ) : isAdded ? (
              <>
                <Check className="h-4 w-4" />
                Agregado
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4" />
                Agregar
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
