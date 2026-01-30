import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Package, Truck, CheckCircle, Clock, Loader2, Search, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Order {
  id: string;
  status: string;
  total: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  tracking_number: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  pending: { label: 'Pendiente', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  paid: { label: 'Pagado', icon: CheckCircle, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  preparing: { label: 'Preparando', icon: Package, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  shipped: { label: 'Enviado', icon: Truck, color: 'text-primary', bgColor: 'bg-primary/10' },
  delivered: { label: 'Entregado', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  cancelled: { label: 'Cancelado', icon: Clock, color: 'text-red-600', bgColor: 'bg-red-100' },
};

export default function AdminOrders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingTrackingId, setEditingTrackingId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    setOrders(data || []);
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus as 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' })
      .eq('id', orderId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Estado actualizado' });
      fetchOrders();
    }
  };

  const saveTrackingNumber = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ tracking_number: trackingNumber, status: 'shipped' })
      .eq('id', orderId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Número de guía guardado' });
      setEditingTrackingId(null);
      setTrackingNumber('');
      fetchOrders();
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shipping_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shipping_city.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-2xl font-bold text-foreground">Pedidos</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-64"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todos los estados</option>
            {Object.entries(statusConfig).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl">
          <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            No hay pedidos
          </h3>
          <p className="text-muted-foreground">
            {searchTerm || statusFilter !== 'all' 
              ? 'No se encontraron pedidos con estos filtros' 
              : 'Los pedidos aparecerán aquí'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => {
            const status = statusConfig[order.status];
            const StatusIcon = status.icon;
            
            return (
              <div key={order.id} className="bg-card rounded-xl p-6 shadow-soft">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${status.bgColor} ${status.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Cliente</p>
                        <p className="font-medium text-foreground">{order.shipping_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Teléfono</p>
                        <p className="font-medium text-foreground">{order.shipping_phone}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ciudad</p>
                        <p className="font-medium text-foreground">{order.shipping_city}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-display font-bold text-foreground">${order.total.toLocaleString('es-CO')}</p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(order.created_at).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Tracking number */}
                    {editingTrackingId === order.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                          placeholder="Número de guía"
                          className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm w-40"
                        />
                        <button 
                          onClick={() => saveTrackingNumber(order.id)}
                          className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                        >
                          Guardar
                        </button>
                        <button 
                          onClick={() => setEditingTrackingId(null)}
                          className="px-3 py-2 border border-border rounded-lg text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : order.tracking_number ? (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Guía: </span>
                        <span className="font-medium text-primary">{order.tracking_number}</span>
                      </div>
                    ) : order.status === 'preparing' || order.status === 'paid' ? (
                      <button 
                        onClick={() => {
                          setEditingTrackingId(order.id);
                          setTrackingNumber(order.tracking_number || '');
                        }}
                        className="px-4 py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/10 transition-colors flex items-center gap-2"
                      >
                        <Truck className="h-4 w-4" />
                        Agregar Guía
                      </button>
                    ) : null}

                    {/* Status dropdown */}
                    <div className="relative">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className="appearance-none px-4 py-2 pr-8 rounded-lg border border-input bg-background text-foreground text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {Object.entries(statusConfig).map(([key, value]) => (
                          <option key={key} value={key}>{value.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
