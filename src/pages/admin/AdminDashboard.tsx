import { useState, useEffect } from 'react';
import { Navigate, Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Truck, 
  Coffee, 
  LogOut,
  Menu,
  X,
  Loader2,
  RefreshCw,
  Ticket,
  CreditCard
} from 'lucide-react';
import logoKpu from '@/assets/logo-kpu.png';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  totalCustomers: number;
}

export default function AdminDashboard() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
  });

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin]);

  const fetchStats = async () => {
    const [ordersRes, pendingRes, productsRes, customersRes] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['pending', 'paid', 'preparing']),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);

    setStats({
      totalOrders: ordersRes.count || 0,
      pendingOrders: pendingRes.count || 0,
      totalProducts: productsRes.count || 0,
      totalCustomers: customersRes.count || 0,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { path: '/admin/productos', icon: Coffee, label: 'Productos' },
    { path: '/admin/pedidos', icon: Package, label: 'Pedidos' },
    { path: '/admin/clientes', icon: Users, label: 'Clientes' },
    { path: '/admin/envios', icon: Truck, label: 'Envíos' },
    { path: '/admin/suscripciones', icon: RefreshCw, label: 'Suscripciones' },
    { path: '/admin/planes', icon: CreditCard, label: 'Planes' },
    { path: '/admin/cupones', icon: Ticket, label: 'Cupones' },
  ];

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const isMainDashboard = location.pathname === '/admin';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-secondary transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-secondary-foreground/10">
            <Link to="/" className="flex items-center gap-3">
              <img src={logoKpu} alt="KPU" className="h-10 w-10 rounded-full object-cover" />
              <div>
                <span className="text-secondary-foreground font-display text-lg font-bold">KPU Admin</span>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
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
              Cerrar Sesión
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
            <button 
              className="lg:hidden p-2"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="font-display text-xl font-semibold text-foreground">
              {navItems.find(item => isActive(item.path, item.exact))?.label || 'Admin'}
            </h1>
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
              Ver tienda →
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {isMainDashboard ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-card rounded-xl p-6 shadow-soft">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Total Pedidos</p>
                    <p className="font-display text-2xl font-bold text-foreground">{stats.totalOrders}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-soft">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                    <Truck className="h-6 w-6 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Pendientes</p>
                    <p className="font-display text-2xl font-bold text-foreground">{stats.pendingOrders}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-soft">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                    <Coffee className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Productos</p>
                    <p className="font-display text-2xl font-bold text-foreground">{stats.totalProducts}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-soft">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Clientes</p>
                    <p className="font-display text-2xl font-bold text-foreground">{stats.totalCustomers}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
