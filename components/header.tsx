'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ShoppingBag, Menu, X, User, LogOut, Package, RefreshCw, Settings } from 'lucide-react';
import { useCart, useAuth } from '@/components/providers';

export default function Header() {
  const { totalItems, setIsCartOpen } = useCart();
  const { user, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
    setIsUserMenuOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-secondary/98 backdrop-blur-xl border-b border-secondary-foreground/10 shadow-[0_2px_24px_hsl(15_45%_10%/0.4)]'
          : 'bg-secondary/90 backdrop-blur-lg border-b border-secondary-foreground/8'
      }`}
    >
      <div className="container mx-auto px-4 py-3.5">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Image
                src="/lovable-uploads/b5ca903b-190c-42d1-bc05-a7b7aa79b434.png"
                alt="KPU Cafe Colombiano"
                width={44}
                height={44}
                className="relative rounded-full object-cover ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all duration-300"
              />
            </div>
            <div className="hidden sm:block">
              <span className="text-secondary-foreground font-display text-2xl tracking-wide leading-none">KPU</span>
              <span className="font-sans text-xs font-bold block tracking-widest uppercase" style={{ color: 'hsl(14 82% 72%)' }}>
                Cafe Colombiano
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Navegacion principal" className="hidden md:flex items-center gap-8">
            {['/#productos', '/#suscripciones', '/#nosotros', '/#contacto'].map((href, i) => {
              const labels = ['Productos', 'Suscripciones', 'Nosotros', 'Contacto'];
              return (
                <a
                  key={href}
                  href={href}
                  className="relative text-secondary-foreground/75 hover:text-secondary-foreground transition-colors duration-200 font-medium text-sm group"
                >
                  {labels[i]}
                  <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-primary group-hover:w-full transition-all duration-300" />
                </a>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  aria-label="Menu de usuario"
                  aria-expanded={isUserMenuOpen}
                  className="hidden md:flex items-center gap-2.5 text-secondary-foreground/75 hover:text-secondary-foreground transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center ring-1 ring-primary/30">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm">Mi cuenta</span>
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border py-2 z-50 shadow-elevated overflow-hidden bg-card">
                      <Link
                        href="/mis-pedidos"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-foreground hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none transition-colors text-sm"
                      >
                        <Package className="h-4 w-4 text-muted-foreground" />
                        Mis Pedidos
                      </Link>
                      <Link
                        href="/mis-suscripciones"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-foreground hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none transition-colors text-sm"
                      >
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                        Mis Suscripciones
                      </Link>
                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-primary hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none transition-colors text-sm font-medium"
                        >
                          <Settings className="h-4 w-4" />
                          Panel Admin
                        </Link>
                      )}
                      <hr className="my-1.5 border-border/60" />
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-4 py-2.5 text-destructive hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none transition-colors w-full text-sm cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        Cerrar Sesion
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/auth"
                className="hidden md:flex items-center gap-2 text-secondary-foreground/75 hover:text-secondary-foreground transition-colors text-sm font-medium"
              >
                <User className="h-4 w-4" />
                Ingresar
              </Link>
            )}

            <button
              onClick={() => setIsCartOpen(true)}
              aria-label={`Carrito de compras, ${mounted ? totalItems : 0} artículos`}
              className="relative p-2.5 text-secondary-foreground/75 hover:text-secondary-foreground transition-colors rounded-xl hover:bg-secondary-foreground/10 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ShoppingBag className="h-5 w-5" />
              {mounted && totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[hsl(14_82%_40%)] text-white text-[11px] font-bold h-5 w-5 rounded-full flex items-center justify-center leading-none">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </button>

            <button
              className="md:hidden p-2.5 text-secondary-foreground/75 hover:text-secondary-foreground rounded-xl hover:bg-secondary-foreground/10 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <nav
            aria-label="Menu movil"
            className="md:hidden pt-4 pb-3 border-t border-secondary-foreground/10 mt-3 animate-fade-in"
          >
            <div className="flex flex-col gap-1">
              {[['/#productos', 'Productos'], ['/#suscripciones', 'Suscripciones'], ['/#nosotros', 'Nosotros'], ['/#contacto', 'Contacto']].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-secondary-foreground/75 hover:text-secondary-foreground hover:bg-secondary-foreground/8 transition-colors font-medium py-2.5 px-3 rounded-xl text-sm"
                >
                  {label}
                </a>
              ))}
              <hr className="border-secondary-foreground/10 my-1" />
              {user ? (
                <>
                  <Link href="/mis-pedidos" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 text-secondary-foreground/75 hover:text-secondary-foreground hover:bg-secondary-foreground/8 transition-colors py-2.5 px-3 rounded-xl text-sm">
                    <Package className="h-4 w-4" />
                    Mis Pedidos
                  </Link>
                  <Link href="/mis-suscripciones" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 text-secondary-foreground/75 hover:text-secondary-foreground hover:bg-secondary-foreground/8 transition-colors py-2.5 px-3 rounded-xl text-sm">
                    <RefreshCw className="h-4 w-4" />
                    Mis Suscripciones
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 text-primary hover:bg-secondary-foreground/8 transition-colors py-2.5 px-3 rounded-xl text-sm font-medium">
                      <Settings className="h-4 w-4" />
                      Panel Admin
                    </Link>
                  )}
                  <button onClick={handleSignOut} className="flex items-center gap-2.5 text-destructive hover:bg-secondary-foreground/8 transition-colors py-2.5 px-3 rounded-xl text-sm w-full cursor-pointer">
                    <LogOut className="h-4 w-4" />
                    Cerrar Sesion
                  </button>
                </>
              ) : (
                <Link href="/auth" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 text-secondary-foreground/75 hover:text-secondary-foreground hover:bg-secondary-foreground/8 transition-colors py-2.5 px-3 rounded-xl text-sm">
                  <User className="h-4 w-4" />
                  Ingresar
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
