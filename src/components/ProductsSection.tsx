import ProductCard from './ProductCard';
import productoCafe from '@/assets/producto-cafe.jpg';
import productoCafeBeans from '@/assets/producto-cafe-beans.png';

const products = [
  {
    id: 'amarillo-exclusivo',
    name: 'Amarillo Exclusivo',
    description: 'Desde las montañas del sur de Colombia, este café destaca por sus notas de miel, canela y frutos amarillos.',
    basePrice: 35000,
    image: productoCafe,
    weights: [
      { value: '250g', priceModifier: 0 },
      { value: '500g', priceModifier: 25000 },
      { value: '1kg', priceModifier: 55000 },
    ],
    grinds: ['Grano', 'Molido'],
    roastLevel: 3,
    origin: 'Huila',
  },
  {
    id: 'tostado-oscuro',
    name: 'Tostado Intenso',
    description: 'Un café con cuerpo robusto y notas de chocolate amargo, cacao y nueces tostadas. Perfecto para espresso.',
    basePrice: 38000,
    image: productoCafeBeans,
    weights: [
      { value: '250g', priceModifier: 0 },
      { value: '500g', priceModifier: 28000 },
      { value: '1kg', priceModifier: 60000 },
    ],
    grinds: ['Grano', 'Molido'],
    roastLevel: 5,
    origin: 'Nariño',
  },
  {
    id: 'suave-aromatico',
    name: 'Suave Aromático',
    description: 'Delicado y fragante con notas florales, cítricos suaves y un final dulce. Ideal para métodos filtrados.',
    basePrice: 32000,
    image: productoCafe,
    weights: [
      { value: '250g', priceModifier: 0 },
      { value: '500g', priceModifier: 22000 },
      { value: '1kg', priceModifier: 50000 },
    ],
    grinds: ['Grano', 'Molido'],
    roastLevel: 2,
    origin: 'Cauca',
  },
];

export default function ProductsSection() {
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
      </div>
    </section>
  );
}
