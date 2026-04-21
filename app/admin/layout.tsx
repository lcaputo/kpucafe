'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers';
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  Coffee,
  LogOut,
  Menu,
  Loader2,
  RefreshCw,
  Ticket,
  CreditCard,
  LayoutGrid,
} from 'lucide-react';

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/admin/productos', icon: Coffee, label: 'Productos' },
  { path: '/admin/categorias', icon: LayoutGrid, label: 'Categorias' },
  { path: '/admin/pedidos', icon: Package, label: 'Pedidos' },
  { path: '/admin/clientes', icon: Users, label: 'Clientes' },
  { path: '/admin/envios', icon: Truck, label: 'Envios' },
  { path: '/admin/suscripciones', icon: RefreshCw, label: 'Suscripciones' },
  { path: '/admin/planes', icon: CreditCard, label: 'Planes' },
  { path: '/admin/cupones', icon: Ticket, label: 'Cupones' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    router.replace('/');
    return null;
  }

  const isActive = (path: string, exact = false) => {
    if (exact) return pathname === path;
    return pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-secondary transform transition-transform duration-300 lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-secondary-foreground/10">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Coffee className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-secondary-foreground font-display text-lg font-bold">
                  KPU Admin
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive(item.path, item.exact)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-secondary-foreground/70 hover:bg-secondary-foreground/10'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-secondary-foreground/10">
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-secondary-foreground/70 hover:bg-secondary-foreground/10 transition-colors w-full"
            >
              <LogOut className="h-5 w-5" />
              Cerrar Sesion
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <button className="lg:hidden p-2" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="font-display text-xl font-semibold text-foreground">
              {navItems.find((item) => isActive(item.path, item.exact))?.label || 'Admin'}
            </h1>
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
              Ver tienda &rarr;
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
