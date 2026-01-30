import { useState } from 'react';
import { ShoppingBag, Check } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

interface Product {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  image: string;
  weights: { value: string; priceModifier: number }[];
  grinds: string[];
  roastLevel: number;
  origin: string;
}

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem, setIsCartOpen } = useCart();
  const [selectedWeight, setSelectedWeight] = useState(product.weights[0]);
  const [selectedGrind, setSelectedGrind] = useState(product.grinds[0]);
  const [isAdded, setIsAdded] = useState(false);

  const currentPrice = product.basePrice + selectedWeight.priceModifier;

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

        {/* Weight Selection */}
        <div className="mb-4">
          <span className="text-xs text-muted-foreground block mb-2">Presentación:</span>
          <div className="flex gap-2">
            {product.weights.map(weight => (
              <button
                key={weight.value}
                onClick={() => setSelectedWeight(weight)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                  selectedWeight.value === weight.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-foreground hover:border-primary'
                }`}
              >
                {weight.value}
              </button>
            ))}
          </div>
        </div>

        {/* Grind Selection */}
        <div className="mb-6">
          <span className="text-xs text-muted-foreground block mb-2">Molido:</span>
          <div className="flex gap-2">
            {product.grinds.map(grind => (
              <button
                key={grind}
                onClick={() => setSelectedGrind(grind)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                  selectedGrind === grind
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-foreground hover:border-primary'
                }`}
              >
                {grind}
              </button>
            ))}
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
            disabled={isAdded}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold transition-all duration-300 ${
              isAdded
                ? 'bg-green-500 text-white'
                : 'bg-primary text-primary-foreground hover:shadow-warm hover:scale-105'
            }`}
          >
            {isAdded ? (
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
