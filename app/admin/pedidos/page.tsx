'use client';

import { useState, useEffect } from 'react';
import { Package, Truck, CheckCircle, Clock, Loader2, Search, ChevronDown, ChevronUp, X, ArrowRight, MapPin, ExternalLink } from 'lucide-react';
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
  deliveryMethod: string | null;
  muStatus: string | null;
  muDriverName: string | null;
  muDriverPhone: string | null;
  muDriverPlate: string | null;
  muTrackingUrl: string | null;
  scheduledDate: string | null;
}

const STATUS_FLOW = ['pending', 'paid', 'preparing', 'shipped', 'delivered'];

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pending:   { label: 'Pendiente',  icon: Clock,        color: 'text-yellow-700', bg: 'bg-yellow-100' },
  paid:      { label: 'Pagado',     icon: CheckCircle,  color: 'text-blue-700',   bg: 'bg-blue-100'   },
  preparing: { label: 'Preparando', icon: Package,      color: 'text-orange-700', bg: 'bg-orange-100' },
  shipped:   { label: 'Enviado',    icon: Truck,        color: 'text-primary',    bg: 'bg-primary/10' },
  delivered: { label: 'Entregado',  icon: CheckCircle,  color: 'text-green-700',  bg: 'bg-green-100'  },
  cancelled: { label: 'Cancelado',  icon: X,            color: 'text-red-700',    bg: 'bg-red-100'    },
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
        deliveryMethod: o.deliveryMethod ?? null,
        muStatus: o.muStatus ?? null,
        muDriverName: o.muDriverName ?? null,
        muDriverPhone: o.muDriverPhone ?? null,
        muDriverPlate: o.muDriverPlate ?? null,
        muTrackingUrl: o.muTrackingUrl ?? null,
        scheduledDate: o.scheduledDate ?? null,
      })));
    } catch { /* ignore */ }
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
    // Skip carrier/tracking modal for MU orders — MU handles this automatically
    if (next === 'shipped' && order.deliveryMethod === 'mensajeros_urbanos') {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'shipped' }),
      });
      if (res.ok) fetchOrders();
      return;
    }
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
    if (!trackingNum.trim()) { toast({ title: 'Numero de guia requerido', variant: 'destructive' }); return; }
    if (!finalCarrier.trim()) { toast({ title: 'Selecciona un transportista', variant: 'destructive' }); return; }
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
    const matchSearch =
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.shipping_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.shipping_city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch && (statusFilter === 'all' || o.status === statusFilter);
  });

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por ID, cliente o ciudad..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-72 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
        >
          <option value="all">Todos los estados</option>
          {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl">
          <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">{searchTerm || statusFilter !== 'all' ? 'Sin resultados' : 'Los pedidos apareceran aqui'}</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Pedido</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Ciudad</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Total</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Guía</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => {
                  const cfg = statusConfig[order.status] ?? statusConfig.pending;
                  const StatusIcon = cfg.icon;
                  const nextStatus = getNextStatus(order.status);
                  const isExpanded = expandedId === order.id;

                  return (
                    <>
                      <tr
                        key={order.id}
                        className={`border-b border-border transition-colors ${isExpanded ? 'bg-muted/30' : 'hover:bg-muted/20'}`}
                      >
                        {/* ID */}
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </td>

                        {/* Fecha */}
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">
                          {new Date(order.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>

                        {/* Cliente */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{order.shipping_name}</p>
                          <p className="text-xs text-muted-foreground">{order.shipping_phone}</p>
                        </td>

                        {/* Ciudad */}
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">
                          {order.shipping_city}{order.shipping_department ? `, ${order.shipping_department}` : ''}
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${cfg.color} ${cfg.bg}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {cfg.label}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="px-4 py-3 text-right font-display text-foreground whitespace-nowrap">
                          ${order.total.toLocaleString('es-CO')}
                        </td>

                        {/* Guía */}
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">
                          {order.tracking_number ? (
                            <span className="text-primary">
                              {order.carrier && `${order.carrier} · `}{order.tracking_number}
                            </span>
                          ) : '—'}
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            {nextStatus && order.status !== 'cancelled' && (
                              <button
                                onClick={() => advanceStatus(order)}
                                disabled={advancing === order.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[hsl(14_82%_40%)] text-white rounded-lg text-xs font-medium hover:bg-[hsl(14_82%_35%)] transition-colors disabled:opacity-50 whitespace-nowrap"
                              >
                                {advancing === order.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <ArrowRight className="h-3 w-3" />}
                                {statusConfig[nextStatus].label}
                              </button>
                            )}
                            <button
                              onClick={() => toggleExpand(order.id)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                              aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                            >
                              {isExpanded
                                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr key={`${order.id}-expanded`} className="bg-muted/10 border-b border-border">
                          <td colSpan={8} className="px-6 py-5">
                            <div className="grid sm:grid-cols-2 gap-6">
                              {/* Shipping */}
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> Dirección de envío
                                </p>
                                <div className="bg-background rounded-lg p-3 text-sm space-y-0.5 border border-border">
                                  <p className="font-medium text-foreground">{order.shipping_name}</p>
                                  <p className="text-muted-foreground">{order.shipping_phone}</p>
                                  <p className="text-foreground">{order.shipping_address}</p>
                                  <p className="text-foreground">{order.shipping_city}{order.shipping_department && `, ${order.shipping_department}`}</p>
                                  {order.notes && <p className="text-xs text-muted-foreground italic mt-1">Nota: {order.notes}</p>}
                                </div>
                                {order.tracking_number && (
                                  <div className="mt-2 p-2 bg-primary/5 rounded-lg text-sm border border-primary/10">
                                    <p className="font-medium text-primary">{order.carrier && `${order.carrier} · `}Guia: {order.tracking_number}</p>
                                  </div>
                                )}
                                {['pending', 'paid'].includes(order.status) && (
                                  <button
                                    onClick={() => cancelOrder(order.id)}
                                    className="mt-3 text-xs text-red-500 hover:text-red-600 hover:underline"
                                  >
                                    Cancelar pedido
                                  </button>
                                )}
                              </div>

                              {/* Items */}
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Productos</p>
                                {orderItems[order.id] ? (
                                  <div className="space-y-1.5">
                                    {orderItems[order.id].map(item => (
                                      <div key={item.id} className="flex justify-between text-sm bg-background rounded-lg p-2.5 border border-border">
                                        <div>
                                          <p className="font-medium text-foreground">{item.product_name}</p>
                                          <p className="text-xs text-muted-foreground">{item.variant_info} × {item.quantity}</p>
                                        </div>
                                        <p className="text-foreground">${(item.unit_price * item.quantity).toLocaleString('es-CO')}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shipping modal */}
      {shippingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-elevated">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg text-foreground flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" /> Datos de Envío
              </h3>
              <button onClick={() => setShippingModal(null)} className="p-1 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Pedido #{shippingModal.id.slice(0, 8).toUpperCase()} — {shippingModal.shipping_name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Transportista *</label>
                <select value={carrier} onChange={e => setCarrier(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm">
                  <option value="">Selecciona...</option>
                  {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {carrier === 'Otro' && (
                  <input type="text" value={customCarrier} onChange={e => setCustomCarrier(e.target.value)}
                    placeholder="Nombre del transportista"
                    className="w-full mt-2 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Número de guía *</label>
                <input type="text" value={trackingNum} onChange={e => setTrackingNum(e.target.value)}
                  placeholder="Ej: 1234567890"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShippingModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={confirmShipping} disabled={advancing === shippingModal.id}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[hsl(14_82%_40%)] text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[hsl(14_82%_35%)] transition-colors">
                {advancing === shippingModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Confirmar Envío
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
