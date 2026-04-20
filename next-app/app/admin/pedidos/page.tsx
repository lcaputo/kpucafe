'use client';

import { useState, useEffect } from 'react';
import { Package, Truck, CheckCircle, Clock, Loader2, Search, ChevronRight, ChevronDown, ChevronUp, MapPin, X, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  variant_info: string;
}

interface Order {
  id: string;
  status: string;
  total: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_department: string | null;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS_FLOW = ['pending', 'paid', 'preparing', 'shipped', 'delivered'];

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  pending: { label: 'Pendiente', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  paid: { label: 'Pagado', icon: CheckCircle, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  preparing: { label: 'Preparando', icon: Package, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  shipped: { label: 'Enviado', icon: Truck, color: 'text-primary', bgColor: 'bg-primary/10' },
  delivered: { label: 'Entregado', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  cancelled: { label: 'Cancelado', icon: X, color: 'text-red-600', bgColor: 'bg-red-100' },
};

const CARRIERS = ['Servientrega', 'Coordinadora', 'Inter Rapidisimo', 'Envia', 'TCC', 'Deprisa', '472 (4-72)', 'Otro'];

export default function AdminOrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [shippingModal, setShippingModal] = useState<Order | null>(null);
  const [trackingNum, setTrackingNum] = useState('');
  const [carrier, setCarrier] = useState('');
  const [customCarrier, setCustomCarrier] = useState('');
  const [advancing, setAdvancing] = useState<string | null>(null);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/admin/orders');
      const data = await res.json();
      setOrders((data as any[]).map((o: any) => ({
        id: o.id,
        status: o.status,
        total: o.total,
        shipping_name: o.shippingName,
        shipping_phone: o.shippingPhone,
        shipping_address: o.shippingAddress,
        shipping_city: o.shippingCity,
        shipping_department: o.shippingDepartment,
        tracking_number: o.trackingNumber,
        carrier: o.carrier,
        notes: o.notes,
        created_at: o.createdAt,
      })));
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!orderItems[id]) {
      try {
        const res = await fetch(`/api/admin/orders/${id}`);
        const data = await res.json();
        setOrderItems(prev => ({
          ...prev,
          [id]: (data as any[]).map((item: any) => ({
            id: item.id,
            product_name: item.productName,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            variant_info: item.variantInfo,
          })),
        }));
      } catch {
        setOrderItems(prev => ({ ...prev, [id]: [] }));
      }
    }
  };

  const getNextStatus = (current: string) => {
    const i = STATUS_FLOW.indexOf(current);
    return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
  };

  const advanceStatus = async (order: Order) => {
    const next = getNextStatus(order.status);
    if (!next) return;

    if (next === 'shipped') {
      setShippingModal(order);
      setTrackingNum(order.tracking_number || '');
      setCarrier(order.carrier || '');
      setCustomCarrier('');
      return;
    }

    setAdvancing(order.id);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: `Pedido avanzado a "${statusConfig[next].label}"` });
      fetchOrders();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setAdvancing(null);
  };

  const confirmShipping = async () => {
    if (!shippingModal) return;
    const finalCarrier = carrier === 'Otro' ? customCarrier : carrier;
    if (!trackingNum.trim()) {
      toast({ title: 'Numero de guia requerido', variant: 'destructive' });
      return;
    }
    if (!finalCarrier.trim()) {
      toast({ title: 'Selecciona un transportista', variant: 'destructive' });
      return;
    }

    setAdvancing(shippingModal.id);
    try {
      const res = await fetch(`/api/admin/orders/${shippingModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'shipped', trackingNumber: trackingNum.trim(), carrier: finalCarrier.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Pedido marcado como enviado' });
      setShippingModal(null);
      fetchOrders();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setAdvancing(null);
  };

  const cancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Pedido cancelado' }); fetchOrders();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.shipping_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.shipping_city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch && (statusFilter === 'all' || o.status === statusFilter);
  });

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">Pedidos</h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-56" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm">
            <option value="all">Todos</option>
            {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl">
          <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">{searchTerm || statusFilter !== 'all' ? 'Sin resultados' : 'Los pedidos apareceran aqui'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const status = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            const nextStatus = getNextStatus(order.status);
            const isExpanded = expandedId === order.id;

            return (
              <div key={order.id} className="bg-card rounded-xl shadow-soft overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(order.id)}>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${status.bgColor} ${status.color} whitespace-nowrap`}>
                        <StatusIcon className="h-3 w-3" />{status.label}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                          <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{order.shipping_name}</p>
                      </div>
                      <span className="font-display text-sm sm:text-base font-bold text-foreground ml-auto sm:ml-2">${order.total.toLocaleString('es-CO')}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {nextStatus && order.status !== 'cancelled' && (
                        <button onClick={() => advanceStatus(order)} disabled={advancing === order.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs sm:text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                          {advancing === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                          {statusConfig[nextStatus].label}
                        </button>
                      )}
                      {order.tracking_number && (
                        <span className="text-xs text-primary font-medium hidden sm:inline">
                          {order.carrier && `${order.carrier} \u00b7 `}{order.tracking_number}
                        </span>
                      )}
                      <button onClick={() => toggleExpand(order.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-5 border-t border-border pt-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1"><MapPin className="h-3 w-3" /> Envio</p>
                        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-0.5">
                          <p className="font-medium text-foreground">{order.shipping_name}</p>
                          <p className="text-muted-foreground">{order.shipping_phone}</p>
                          <p className="text-foreground">{order.shipping_address}</p>
                          <p className="text-foreground">{order.shipping_city}{order.shipping_department && `, ${order.shipping_department}`}</p>
                          {order.notes && <p className="text-xs text-muted-foreground italic mt-1">Nota: {order.notes}</p>}
                        </div>
                        {order.tracking_number && (
                          <div className="mt-2 p-2 bg-primary/5 rounded-lg text-sm">
                            <p className="font-medium text-primary">{order.carrier && `${order.carrier} \u00b7 `}Guia: {order.tracking_number}</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Productos</p>
                        {orderItems[order.id] ? (
                          <div className="space-y-2">
                            {orderItems[order.id].map(item => (
                              <div key={item.id} className="flex justify-between text-sm bg-muted/50 rounded-lg p-2.5">
                                <div>
                                  <p className="font-medium text-foreground">{item.product_name}</p>
                                  <p className="text-xs text-muted-foreground">{item.variant_info} x {item.quantity}</p>
                                </div>
                                <p className="font-semibold text-foreground">${(item.unit_price * item.quantity).toLocaleString('es-CO')}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
                      {STATUS_FLOW.map((s, i) => {
                        const cfg = statusConfig[s];
                        const currentIdx = STATUS_FLOW.indexOf(order.status);
                        const done = i <= currentIdx;
                        return (
                          <div key={s} className="flex items-center gap-1 flex-shrink-0">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium ${done ? cfg.bgColor + ' ' + cfg.color : 'bg-muted text-muted-foreground'}`}>
                              {cfg.label}
                            </span>
                            {i < STATUS_FLOW.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>

                    {['pending', 'paid'].includes(order.status) && (
                      <button onClick={() => cancelOrder(order.id)} className="mt-3 text-xs text-red-500 hover:text-red-600 hover:underline">
                        Cancelar pedido
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Shipping modal */}
      {shippingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-elevated">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />Datos de Envio
              </h3>
              <button onClick={() => setShippingModal(null)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Pedido #{shippingModal.id.slice(0, 8).toUpperCase()} -- {shippingModal.shipping_name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Transportista *</label>
                <select value={carrier} onChange={e => setCarrier(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground">
                  <option value="">Selecciona...</option>
                  {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {carrier === 'Otro' && (
                  <input type="text" value={customCarrier} onChange={e => setCustomCarrier(e.target.value)}
                    placeholder="Nombre del transportista" className="w-full mt-2 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Numero de guia *</label>
                <input type="text" value={trackingNum} onChange={e => setTrackingNum(e.target.value)}
                  placeholder="Ej: 1234567890" className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShippingModal(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={confirmShipping} disabled={advancing === shippingModal.id}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {advancing === shippingModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Confirmar Envio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
