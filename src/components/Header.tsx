import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Menu, X, User } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import logoKpu from '@/assets/logo-kpu.png';

export default function Header() {
  const { totalItems, setIsCartOpen } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-md border-b border-secondary-foreground/10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img 
              src={logoKpu} 
              alt="KPU Café Colombiano" 
              className="h-12 w-12 rounded-full object-cover"
            />
            <div className="hidden sm:block">
              <span className="text-secondary-foreground font-display text-xl font-bold">KPU</span>
              <span className="text-primary font-display text-sm block -mt-1">Café Colombiano</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#productos" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium">
              Productos
            </a>
            <a href="#suscripciones" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium">
              Suscripciones
            </a>
            <a href="#nosotros" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium">
              Nosotros
            </a>
            <a href="#contacto" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium">
              Contacto
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button className="hidden md:flex items-center gap-2 text-secondary-foreground/80 hover:text-primary transition-colors">
              <User className="h-5 w-5" />
              <span className="font-medium">Ingresar</span>
            </button>

            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-secondary-foreground/80 hover:text-primary transition-colors"
            >
              <ShoppingBag className="h-6 w-6" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold h-5 w-5 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>

            <button 
              className="md:hidden p-2 text-secondary-foreground/80"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <nav className="md:hidden pt-4 pb-2 border-t border-secondary-foreground/10 mt-4">
            <div className="flex flex-col gap-3">
              <a href="#productos" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium py-2">
                Productos
              </a>
              <a href="#suscripciones" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium py-2">
                Suscripciones
              </a>
              <a href="#nosotros" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium py-2">
                Nosotros
              </a>
              <a href="#contacto" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium py-2">
                Contacto
              </a>
              <button className="flex items-center gap-2 text-secondary-foreground/80 hover:text-primary transition-colors py-2">
                <User className="h-5 w-5" />
                <span className="font-medium">Ingresar</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
