import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Menu, X, User, LogOut, Package, RefreshCw, Settings } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import logoKpu from '@/assets/logo-kpu.png';
export default function Header() {
  const {
    totalItems,
    setIsCartOpen
  } = useCart();
  const {
    user,
    isAdmin,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setIsUserMenuOpen(false);
  };
  return <header className="fixed top-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-md border-b border-secondary-foreground/10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img alt="KPU Café Colombiano" className="h-12 w-12 rounded-full object-cover" src="/lovable-uploads/27c7512e-5a0b-4786-a622-1136c7768a61.png" />
            <div className="hidden sm:block">
              <span className="text-secondary-foreground font-display text-xl font-bold">KPU</span>
              <span className="text-primary font-display text-sm block -mt-1">Café Colombiano</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="/#productos" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium">
              Productos
            </a>
            <a href="/#suscripciones" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium">
              Suscripciones
            </a>
            <a href="/#nosotros" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium">
              Nosotros
            </a>
            <a href="/#contacto" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium">
              Contacto
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {user ? <div className="relative">
                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="hidden md:flex items-center gap-2 text-secondary-foreground/80 hover:text-primary transition-colors">
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium">Mi cuenta</span>
                </button>

                {isUserMenuOpen && <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl shadow-elevated border border-border py-2 z-50">
                      <Link to="/mis-pedidos" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-card-foreground hover:bg-muted transition-colors">
                        <Package className="h-4 w-4" />
                        Mis Pedidos
                      </Link>
                      <Link to="/mis-suscripciones" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-card-foreground hover:bg-muted transition-colors">
                        <RefreshCw className="h-4 w-4" />
                        Mis Suscripciones
                      </Link>
                      {isAdmin && <Link to="/admin" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-primary hover:bg-muted transition-colors">
                          <Settings className="h-4 w-4" />
                          Panel Admin
                        </Link>}
                      <hr className="my-2 border-border" />
                      <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-2.5 text-destructive hover:bg-muted transition-colors w-full">
                        <LogOut className="h-4 w-4" />
                        Cerrar Sesión
                      </button>
                    </div>
                  </>}
              </div> : <Link to="/auth" className="hidden md:flex items-center gap-2 text-secondary-foreground/80 hover:text-primary transition-colors">
                <User className="h-5 w-5" />
                <span className="font-medium">Ingresar</span>
              </Link>}

            <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-secondary-foreground/80 hover:text-primary transition-colors">
              <ShoppingBag className="h-6 w-6" />
              {totalItems > 0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold h-5 w-5 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>}
            </button>

            <button className="md:hidden p-2 text-secondary-foreground/80" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && <nav className="md:hidden pt-4 pb-2 border-t border-secondary-foreground/10 mt-4">
            <div className="flex flex-col gap-3">
              <a href="/#productos" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium py-2">
                Productos
              </a>
              <a href="/#suscripciones" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium py-2">
                Suscripciones
              </a>
              <a href="/#nosotros" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium py-2">
                Nosotros
              </a>
              <a href="/#contacto" className="text-secondary-foreground/80 hover:text-primary transition-colors font-medium py-2">
                Contacto
              </a>
              <hr className="border-secondary-foreground/10" />
              {user ? <>
                  <Link to="/mis-pedidos" className="flex items-center gap-2 text-secondary-foreground/80 hover:text-primary transition-colors py-2">
                    <Package className="h-5 w-5" />
                    <span className="font-medium">Mis Pedidos</span>
                  </Link>
                  <Link to="/mis-suscripciones" className="flex items-center gap-2 text-secondary-foreground/80 hover:text-primary transition-colors py-2">
                    <RefreshCw className="h-5 w-5" />
                    <span className="font-medium">Mis Suscripciones</span>
                  </Link>
                  {isAdmin && <Link to="/admin" className="flex items-center gap-2 text-primary py-2">
                      <Settings className="h-5 w-5" />
                      <span className="font-medium">Panel Admin</span>
                    </Link>}
                  <button onClick={handleSignOut} className="flex items-center gap-2 text-destructive py-2">
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">Cerrar Sesión</span>
                  </button>
                </> : <Link to="/auth" className="flex items-center gap-2 text-secondary-foreground/80 hover:text-primary transition-colors py-2">
                  <User className="h-5 w-5" />
                  <span className="font-medium">Ingresar</span>
                </Link>}
            </div>
          </nav>}
      </div>
    </header>;
}