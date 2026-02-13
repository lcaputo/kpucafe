import { useState } from 'react';
import { ShoppingBag, Check } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

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
}

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem, setIsCartOpen } = useCart();
  const getStock = (w: string, g: string) => product.stockMap?.[`${w}-${g}`] ?? 1;

  const findInitialSelection = () => {
    for (const grind of product.grinds) {
      for (const weight of product.weights) {
        if (getStock(weight.value, grind) > 0) {
          return { grind, weight };
        }
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
    // If current weight has no stock for this grind, auto-select first available weight
    if (getStock(selectedWeight.value, grind) <= 0) {
      const available = product.weights.find(w => getStock(w.value, grind) > 0);
      if (available) setSelectedWeight(available);
    }
  };

  const handleWeightChange = (weight: typeof product.weights[0]) => {
    setSelectedWeight(weight);
    // If current grind has no stock for this weight, auto-select first available grind
    if (getStock(weight.value, selectedGrind) <= 0) {
      const available = product.grinds.find(g => getStock(weight.value, g) > 0);
      if (available) setSelectedGrind(available);
    }
  };

  const currentPrice = product.priceMap?.[`${selectedWeight.value}-${selectedGrind}`] ?? 0;
  const currentStock = getStock(selectedWeight.value, selectedGrind);
  const isOutOfStock = currentStock <= 0;

  const handleAddToCart = () => {
    addItem({
      id: `${product.id}-${selectedWeight.value}-${selectedGrind}`,
      name: product.name,
      price: currentPrice,
      image: product.image,
      weight: selectedWeight.value,
      grind: selectedGrind,
    });
    
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
      setIsCartOpen(true);
    }, 500);
  };

  return (
    <div className="card-product group">
      {/* Image */}
      <div className="relative overflow-hidden aspect-square bg-muted">
        <img 
          src={product.image} 
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-4 right-4">
          <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
            {product.origin}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="font-display text-xl font-bold text-foreground mb-2">
          {product.name}
        </h3>
        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
          {product.description}
        </p>

        {/* Roast Level */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">Tostado:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(level => (
              <div 
                key={level}
                className={`w-3 h-3 rounded-full ${
                  level <= product.roastLevel 
                    ? 'bg-primary' 
                    : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {product.roastLevel <= 2 ? 'Suave' : product.roastLevel <= 4 ? 'Medio' : 'Fuerte'}
          </span>
        </div>

        {/* Grind Selection (FIRST) */}
        <div className="mb-4">
          <span className="text-xs text-muted-foreground block mb-2">Tipo:</span>
          <div className="flex gap-2">
            {product.grinds.map(grind => {
              const allWeightsOut = product.weights.every(w => getStock(w.value, grind) <= 0);
              return (
                <button
                  key={grind}
                  onClick={() => handleGrindChange(grind)}
                  disabled={allWeightsOut}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                    allWeightsOut
                      ? 'border-border text-muted-foreground/40 line-through cursor-not-allowed'
                      : selectedGrind === grind
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-foreground hover:border-primary'
                  }`}
                >
                  {grind}
                </button>
              );
            })}
          </div>
        </div>

        {/* Weight Selection (SECOND) */}
        <div className="mb-6">
          <span className="text-xs text-muted-foreground block mb-2">Presentación:</span>
          <div className="flex gap-2">
            {product.weights.map(weight => {
              const weightOut = getStock(weight.value, selectedGrind) <= 0;
              return (
                <button
                  key={weight.value}
                  onClick={() => handleWeightChange(weight)}
                  disabled={weightOut}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                    weightOut
                      ? 'border-border text-muted-foreground/40 line-through cursor-not-allowed'
                      : selectedWeight.value === weight.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-foreground hover:border-primary'
                  }`}
                >
                  {weight.value}
                </button>
              );
            })}
          </div>
        </div>

        {/* Price & Add to Cart */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-display font-bold text-foreground">
              ${currentPrice.toLocaleString('es-CO')}
            </span>
            <span className="text-muted-foreground text-sm ml-1">COP</span>
          </div>
          
          <button
            onClick={handleAddToCart}
            disabled={isAdded || isOutOfStock}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold transition-all duration-300 ${
              isOutOfStock
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : isAdded
                  ? 'bg-green-500 text-white'
                  : 'bg-primary text-primary-foreground hover:shadow-warm hover:scale-105'
            }`}
          >
            {isOutOfStock ? (
              'Agotado'
            ) : isAdded ? (
              <>
                <Check className="h-5 w-5" />
                Agregado
              </>
            ) : (
              <>
                <ShoppingBag className="h-5 w-5" />
                Agregar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
