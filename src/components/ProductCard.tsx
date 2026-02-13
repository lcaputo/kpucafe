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
  const [selectedGrind, setSelectedGrind] = useState(product.grinds[0]);
  const [selectedWeight, setSelectedWeight] = useState(product.weights[0]);
  const [isAdded, setIsAdded] = useState(false);

  const currentPrice = product.priceMap?.[`${selectedWeight.value}-${selectedGrind}`] ?? 0;
  const currentStock = product.stockMap?.[`${selectedWeight.value}-${selectedGrind}`] ?? null;
  const isOutOfStock = currentStock !== null && currentStock <= 0;

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
              const allWeightsOut = product.weights.every(w => (product.stockMap?.[`${w.value}-${grind}`] ?? 1) <= 0);
              return (
                <button
                  key={grind}
                  onClick={() => setSelectedGrind(grind)}
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
              const weightStock = product.stockMap?.[`${weight.value}-${selectedGrind}`] ?? 1;
              const weightOut = weightStock <= 0;
              return (
                <button
                  key={weight.value}
                  onClick={() => setSelectedWeight(weight)}
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
