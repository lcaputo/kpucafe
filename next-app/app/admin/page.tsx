'use client';

import { useState, useEffect } from 'react';
import { Package, Truck, Coffee, Users, Loader2 } from 'lucide-react';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  totalCustomers: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalOrders: data.totalOrders || 0,
          pendingOrders: data.pendingOrders || 0,
          totalProducts: data.totalProducts || 0,
          totalCustomers: data.totalCustomers || 0,
        });
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
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
  );
}
