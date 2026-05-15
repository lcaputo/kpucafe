'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin, Phone, User, Calendar, ChevronLeft, ChevronRight,
  X, Plus, Search, Loader2, Truck, ExternalLink,
  List, LayoutGrid, Check, ShoppingCart, Minus, Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  productName: string;
  variantInfo: string;
  quantity: number;
  unitPrice: number;
}

interface Domicilio {
  id: string;
  status: string;
  total: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  scheduledDate: string | null;
  muStatus: string | null;
  muDriverName: string | null;
  muDriverPhone: string | null;
  muDriverPlate: string | null;
  muTrackingUrl: string | null;
  muEta: string | null;
  notes: string | null;
  createdAt: string;
  items: OrderItem[];
}

interface CustomerResult {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  registrationComplete: boolean;
}

interface ProductVariant {
  id: string;
  weight: string;
  grind: string;
  priceModifier: number;
  stock: number;
  isActive: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  basePrice: number;
  variants: ProductVariant[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const muStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  create:          { label: 'Creado',     color: 'text-blue-700',   bg: 'bg-blue-100'   },
  on_hold:         { label: 'En espera',  color: 'text-yellow-700', bg: 'bg-yellow-100' },
  assigned:        { label: 'Asignado',   color: 'text-purple-700', bg: 'bg-purple-100' },
  picking_up:      { label: 'Recogiendo', color: 'text-orange-700', bg: 'bg-orange-100' },
  delivering:      { label: 'En camino',  color: 'text-primary',    bg: 'bg-primary/10' },
  finished:        { label: 'Entregado',  color: 'text-green-700',  bg: 'bg-green-100'  },
  error:           { label: 'Error',      color: 'text-red-700',    bg: 'bg-red-100'    },
  failed_delivery: { label: 'Fallido',    color: 'text-red-700',    bg: 'bg-red-100'    },
  cancelled:       { label: 'Cancelado',  color: 'text-gray-700',   bg: 'bg-gray-100'   },
};

const MU_TIMELINE = ['create', 'on_hold', 'assigned', 'picking_up', 'delivering', 'finished'];

const TIME_SLOTS = [
  { label: '9:00 - 12:00',   start: '09:00', end: '12:00' },
  { label: '12:00 - 15:00',  start: '12:00', end: '15:00' },
  { label: '15:00 - 18:00',  start: '15:00', end: '18:00' },
];

const MU_CITIES = ['Barranquilla', 'Bogota', 'Cali', 'Medellin', 'Cartagena'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekDates(baseDate: Date): Date[] {
  const start = new Date(baseDate);
  start.setDate(start.getDate() - start.getDay() + 1); // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function todayStr(): string {
  return formatDate(new Date());
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

function CalendarView({
  domicilios,
  selectedId,
  onSelect,
}: {
  domicilios: Domicilio[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [baseDate, setBaseDate] = useState(new Date());
  const days = getWeekDates(baseDate);

  const prevWeek = () => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 7);
    setBaseDate(d);
  };
  const nextWeek = () => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 7);
    setBaseDate(d);
  };

  const monthLabel = days[0].toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Group domicilios by day and time slot
  const grouped: Record<string, Record<string, Domicilio[]>> = {};
  for (const d of domicilios) {
    const dayKey = d.scheduledDate ? new Date(d.scheduledDate).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) : null;
    if (!dayKey) continue;
    if (!grouped[dayKey]) grouped[dayKey] = {};
    // Determine time slot
    const timePart = d.scheduledDate?.split('T')[1]?.substring(0, 5) ?? '';
    let slot = 'Sin franja';
    for (const ts of TIME_SLOTS) {
      if (timePart >= ts.start && timePart < ts.end) { slot = ts.label; break; }
    }
    if (!grouped[dayKey][slot]) grouped[dayKey][slot] = [];
    grouped[dayKey][slot].push(d);
  }

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevWeek} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <span className="font-medium text-foreground capitalize">{monthLabel}</span>
        <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 overflow-x-auto">
        {days.map((day, i) => {
          const key = formatDate(day);
          const isToday = key === todayStr();
          const dayDoms = grouped[key] ?? {};
          return (
            <div key={key} className={`min-h-[140px] rounded-xl border p-2 flex flex-col gap-1 ${isToday ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{DAY_NAMES[i]}</p>
                <p className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {day.getDate()}
                </p>
              </div>
              {Object.entries(dayDoms).map(([slot, items]) => (
                <div key={slot}>
                  <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{slot}</p>
                  {items.map(dom => {
                    const cfg = dom.muStatus ? muStatusConfig[dom.muStatus] : null;
                    const isSelected = dom.id === selectedId;
                    return (
                      <button
                        key={dom.id}
                        onClick={() => onSelect(dom.id)}
                        className={`w-full text-left px-1.5 py-1 rounded-lg text-xs mb-0.5 border transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50 hover:bg-muted/60 text-foreground'
                        }`}
                      >
                        <p className="font-medium truncate">{dom.shippingName.split(' ')[0]}</p>
                        {cfg && (
                          <span className={`text-[10px] ${cfg.color}`}>{cfg.label}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ListView ─────────────────────────────────────────────────────────────────

function ListView({
  domicilios,
  selectedId,
  onSelect,
  onDispatch,
  dispatching,
}: {
  domicilios: Domicilio[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDispatch: (id: string) => void;
  dispatching: string | null;
}) {
  if (domicilios.length === 0) {
    return (
      <div className="text-center py-16 bg-card rounded-2xl">
        <Truck className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">No hay domicilios</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Ciudad</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Fecha</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Estado</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Total</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {domicilios.map(dom => {
              const cfg = dom.muStatus ? muStatusConfig[dom.muStatus] : null;
              const canDispatch = (!dom.muStatus || dom.muStatus === 'error');
              const isSelected = dom.id === selectedId;
              return (
                <tr
                  key={dom.id}
                  onClick={() => onSelect(dom.id)}
                  className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{dom.shippingName}</p>
                    <p className="text-xs text-muted-foreground">{dom.shippingPhone}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{dom.shippingCity}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {dom.scheduledDate
                      ? new Date(dom.scheduledDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                      : new Date(dom.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    {cfg ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
                        {cfg.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin despachar</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-display text-foreground whitespace-nowrap">
                    ${dom.total.toLocaleString('es-CO')}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {canDispatch && (
                      <button
                        onClick={() => onDispatch(dom.id)}
                        disabled={dispatching === dom.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {dispatching === dom.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Truck className="h-3 w-3" />}
                        Despachar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TrackingPanel ────────────────────────────────────────────────────────────

function TrackingPanel({
  domicilio,
  onClose,
  onDispatch,
  dispatching,
}: {
  domicilio: Domicilio;
  onClose: () => void;
  onDispatch: (id: string) => void;
  dispatching: string | null;
}) {
  const cfg = domicilio.muStatus ? muStatusConfig[domicilio.muStatus] : null;
  const showMap = ['assigned', 'picking_up', 'delivering'].includes(domicilio.muStatus ?? '');
  const currentIdx = MU_TIMELINE.indexOf(domicilio.muStatus ?? '');

  return (
    <div className="w-[360px] flex-shrink-0 sticky top-24 self-start">
      <div className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground text-sm">{domicilio.shippingName}</h3>
            <p className="text-xs text-muted-foreground">#{domicilio.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            {cfg && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color} ${cfg.bg}`}>
                {cfg.label}
              </span>
            )}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Customer info */}
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-foreground">{domicilio.shippingName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{domicilio.shippingPhone}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-foreground">{domicilio.shippingAddress}, {domicilio.shippingCity}</span>
            </div>
          </div>

          {/* Scheduled date */}
          {domicilio.scheduledDate && (
            <div className="flex items-center gap-2 text-sm bg-muted/40 rounded-lg px-3 py-2">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">
                {new Date(domicilio.scheduledDate).toLocaleString('es-CO', {
                  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
          )}

          {/* Driver info */}
          {domicilio.muDriverName && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-purple-800 dark:text-purple-300">Mensajero</p>
              <p className="text-sm text-foreground">{domicilio.muDriverName}</p>
              {domicilio.muDriverPhone && (
                <p className="text-xs text-muted-foreground">{domicilio.muDriverPhone}</p>
              )}
              {domicilio.muDriverPlate && (
                <p className="text-xs text-muted-foreground">Placa: {domicilio.muDriverPlate}</p>
              )}
              {domicilio.muEta && (
                <p className="text-xs text-muted-foreground">ETA: {domicilio.muEta}</p>
              )}
            </div>
          )}

          {/* Map iframe */}
          {showMap && domicilio.muTrackingUrl && (
            <div className="rounded-lg overflow-hidden border border-border">
              <iframe
                src={domicilio.muTrackingUrl}
                className="w-full h-48"
                title="Tracking map"
                loading="lazy"
              />
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Estado del envío</p>
            <div className="flex items-center gap-0">
              {MU_TIMELINE.map((step, i) => {
                const stepCfg = muStatusConfig[step];
                const completed = currentIdx >= i;
                const isLast = i === MU_TIMELINE.length - 1;
                return (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        completed
                          ? 'bg-primary border-primary'
                          : 'bg-background border-border'
                      }`}>
                        {completed && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-1 text-center w-10 leading-tight">
                        {stepCfg?.label}
                      </p>
                    </div>
                    {!isLast && (
                      <div className={`flex-1 h-0.5 mb-4 ${completed && currentIdx > i ? 'bg-primary' : 'bg-border'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Productos</p>
            <div className="space-y-1.5">
              {domicilio.items.map(item => (
                <div key={item.id} className="flex justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                  <div>
                    <p className="font-medium text-foreground text-xs">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{item.variantInfo} × {item.quantity}</p>
                  </div>
                  <p className="text-foreground text-xs font-medium">${(item.unitPrice * item.quantity).toLocaleString('es-CO')}</p>
                </div>
              ))}
              <div className="flex justify-between px-3 py-1 text-sm font-semibold text-foreground border-t border-border mt-1 pt-1">
                <span>Total</span>
                <span>${domicilio.total.toLocaleString('es-CO')}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {domicilio.notes && (
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notas</p>
              <p className="text-sm text-foreground">{domicilio.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-1">
            {(!domicilio.muStatus || domicilio.muStatus === 'error') && (
              <button
                onClick={() => onDispatch(domicilio.id)}
                disabled={dispatching === domicilio.id}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {dispatching === domicilio.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Truck className="h-4 w-4" />}
                Despachar ahora
              </button>
            )}
            {domicilio.muTrackingUrl && (
              <a
                href={domicilio.muTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm text-foreground hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Ver tracking MU
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NewDomicilioForm ─────────────────────────────────────────────────────────

interface CartEntry {
  productId: string;
  variantId: string;
  productName: string;
  variantInfo: string;
  unitPrice: number;
  quantity: number;
}

function NewDomicilioForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2: Products
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);

  // Step 3: Delivery
  const [paymentMethod, setPaymentMethod] = useState<'paid' | 'cod' | 'transfer'>('paid');
  const [dispatchType, setDispatchType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledSlot, setScheduledSlot] = useState(TIME_SLOTS[0].label);
  const [notes, setNotes] = useState('');

  // Customer search with debounce
  useEffect(() => {
    if (!customerSearch.trim() || isNewCustomer) {
      setCustomerResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCustomerSearching(true);
      try {
        const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(customerSearch)}`);
        const data = await res.json();
        setCustomerResults(Array.isArray(data) ? data : []);
      } catch {
        setCustomerResults([]);
      }
      setCustomerSearching(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [customerSearch, isNewCustomer]);

  // Load products when entering step 2
  const loadProducts = useCallback(async () => {
    if (productsLoaded) return;
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
      setProductsLoaded(true);
    } catch { /* ignore */ }
  }, [productsLoaded]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const addVariantToCart = (product: ProductOption, variant: ProductVariant) => {
    const existing = cart.find(c => c.variantId === variant.id);
    if (existing) {
      setCart(cart.map(c => c.variantId === variant.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, {
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        variantInfo: `${variant.weight} - ${variant.grind}`,
        unitPrice: product.basePrice + variant.priceModifier,
        quantity: 1,
      }]);
    }
  };

  const updateCartQty = (variantId: string, delta: number) => {
    setCart(prev =>
      prev.map(c => c.variantId === variantId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)
    );
  };

  const removeFromCart = (variantId: string) => {
    setCart(prev => prev.filter(c => c.variantId !== variantId));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);

  const goToStep2 = () => {
    const hasCustomer = selectedCustomer || (isNewCustomer && newCustomerName.trim());
    if (!hasCustomer) { toast({ title: 'Selecciona o crea un cliente', variant: 'destructive' }); return; }
    if (!deliveryAddress.trim()) { toast({ title: 'Ingresa la dirección de entrega', variant: 'destructive' }); return; }
    if (!deliveryCity) { toast({ title: 'Selecciona la ciudad', variant: 'destructive' }); return; }
    loadProducts();
    setStep(2);
  };

  const goToStep3 = () => {
    if (cart.length === 0) { toast({ title: 'Agrega al menos un producto', variant: 'destructive' }); return; }
    setStep(3);
  };

  const handleSubmit = async () => {
    if (dispatchType === 'scheduled' && !scheduledDate) {
      toast({ title: 'Selecciona una fecha de entrega', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const slot = dispatchType === 'scheduled' ? TIME_SLOTS.find(s => s.label === scheduledSlot) : null;
      const scheduledDateTime = slot && scheduledDate
        ? `${scheduledDate}T${slot.start}:00`
        : null;

      const body = {
        customer: selectedCustomer
          ? { id: selectedCustomer.id, fullName: selectedCustomer.fullName ?? '', email: selectedCustomer.email, phone: selectedCustomer.phone ?? '' }
          : { fullName: newCustomerName, email: newCustomerEmail, phone: newCustomerPhone },
        address: { address: deliveryAddress, city: deliveryCity },
        items: cart.map(c => ({
          productId: c.productId,
          variantId: c.variantId,
          productName: c.productName,
          variantInfo: c.variantInfo,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
        paymentMethod,
        dispatch: { type: dispatchType, date: scheduledDateTime ?? undefined, timeSlot: dispatchType === 'scheduled' ? scheduledSlot : undefined },
        notes: notes.trim(),
      };

      const res = await fetch('/api/admin/domicilios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Error creando domicilio');
      }
      toast({ title: 'Domicilio creado exitosamente' });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const paymentLabels: Record<string, string> = {
    paid: 'Ya pagó',
    cod: 'Contra entrega',
    transfer: 'Transferencia',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-2xl shadow-elevated flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Nuevo domicilio</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Paso {step} de 3</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-5 pt-4">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                s < step ? 'bg-primary text-primary-foreground'
                  : s === step ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {s < step ? <Check className="h-3.5 w-3.5" /> : s}
              </div>
              <span className={`text-xs ${s === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {s === 1 ? 'Cliente' : s === 2 ? 'Productos' : 'Entrega'}
              </span>
              {s < 3 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Step 1: Cliente ── */}
          {step === 1 && (
            <div className="space-y-4">
              {!isNewCustomer ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Buscar cliente</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Nombre, email o teléfono..."
                        value={customerSearch}
                        onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }}
                        className="pl-10 pr-4 py-2.5 w-full rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      {customerSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>

                    {/* Search results */}
                    {customerResults.length > 0 && !selectedCustomer && (
                      <div className="mt-1 border border-border rounded-xl bg-background shadow-soft overflow-hidden">
                        {customerResults.map(c => (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.fullName || c.email); setCustomerResults([]); }}
                            className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-foreground">{c.fullName || c.email}</p>
                                <p className="text-xs text-muted-foreground">{c.phone || c.email}</p>
                              </div>
                              {!c.registrationComplete && (
                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                                  Pre-registro
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Selected customer */}
                    {selectedCustomer && (
                      <div className="mt-2 flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{selectedCustomer.fullName || selectedCustomer.email}</p>
                          <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
                        </div>
                        <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="p-1 hover:bg-muted rounded-lg">
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-center">
                    <button onClick={() => setIsNewCustomer(true)} className="text-sm text-primary hover:underline">
                      + Crear nuevo cliente
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Nuevo cliente</p>
                    <button onClick={() => setIsNewCustomer(false)} className="text-xs text-muted-foreground hover:text-foreground">
                      ← Buscar existente
                    </button>
                  </div>
                  <input type="text" placeholder="Nombre completo *" value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input type="email" placeholder="Email" value={newCustomerEmail}
                    onChange={e => setNewCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input type="tel" placeholder="Teléfono" value={newCustomerPhone}
                    onChange={e => setNewCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              )}

              {/* Address */}
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Dirección de entrega</p>
                <input type="text" placeholder="Dirección *" value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <select value={deliveryCity} onChange={e => setDeliveryCity(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Selecciona ciudad *</option>
                  {MU_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* ── Step 2: Productos ── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Product search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Products list */}
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {filteredProducts.map(product => (
                  <div key={product.id} className="bg-muted/30 rounded-xl p-3">
                    <p className="text-sm font-medium text-foreground mb-2">{product.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {product.variants.filter(v => v.isActive).map(variant => {
                        const inCart = cart.find(c => c.variantId === variant.id);
                        return (
                          <button
                            key={variant.id}
                            onClick={() => addVariantToCart(product, variant)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                              inCart
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {variant.weight} · {variant.grind} · ${(product.basePrice + variant.priceModifier).toLocaleString('es-CO')}
                            {inCart && <span className="ml-1 font-semibold">×{inCart.quantity}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
                )}
              </div>

              {/* Cart */}
              {cart.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" /> Carrito
                  </p>
                  <div className="space-y-2">
                    {cart.map(entry => (
                      <div key={entry.variantId} className="flex items-center gap-3 bg-background rounded-xl px-3 py-2 border border-border">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{entry.productName}</p>
                          <p className="text-xs text-muted-foreground">{entry.variantInfo}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateCartQty(entry.variantId, -1)}
                            className="p-1 rounded-lg hover:bg-muted transition-colors">
                            <Minus className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <span className="text-sm font-medium text-foreground w-5 text-center">{entry.quantity}</span>
                          <button onClick={() => updateCartQty(entry.variantId, 1)}
                            className="p-1 rounded-lg hover:bg-muted transition-colors">
                            <Plus className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                        <p className="text-xs font-semibold text-foreground w-16 text-right">
                          ${(entry.unitPrice * entry.quantity).toLocaleString('es-CO')}
                        </p>
                        <button onClick={() => removeFromCart(entry.variantId)}
                          className="p-1 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2 font-semibold text-foreground text-sm border-t border-border">
                      <span>Total</span>
                      <span>${cartTotal.toLocaleString('es-CO')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Entrega ── */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Payment method */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Método de pago</p>
                <div className="flex gap-2">
                  {(['paid', 'cod', 'transfer'] as const).map(pm => (
                    <button key={pm} onClick={() => setPaymentMethod(pm)}
                      className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${
                        paymentMethod === pm
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}>
                      {paymentLabels[pm]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dispatch type */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Tipo de despacho</p>
                <div className="flex gap-2">
                  {(['immediate', 'scheduled'] as const).map(dt => (
                    <button key={dt} onClick={() => setDispatchType(dt)}
                      className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${
                        dispatchType === dt
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}>
                      {dt === 'immediate' ? 'Inmediato' : 'Programado'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scheduled fields */}
              {dispatchType === 'scheduled' && (
                <div className="space-y-3 bg-muted/30 rounded-xl p-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha de entrega</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      min={todayStr()}
                      onChange={e => setScheduledDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Franja horaria</label>
                    <div className="flex gap-2">
                      {TIME_SLOTS.map(slot => (
                        <button key={slot.label} onClick={() => setScheduledSlot(slot.label)}
                          className={`flex-1 py-2 rounded-xl text-xs border transition-colors ${
                            scheduledSlot === slot.label
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border text-muted-foreground hover:bg-muted'
                          }`}>
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Notas (opcional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Instrucciones especiales, referencias..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Summary */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Resumen</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="text-foreground font-medium">
                    {selectedCustomer?.fullName || newCustomerName}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ciudad</span>
                  <span className="text-foreground">{deliveryCity}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Productos</span>
                  <span className="text-foreground">{cart.reduce((s, c) => s + c.quantity, 0)} items</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-border pt-2 mt-1">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">${cartTotal.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pago</span>
                  <span className="text-foreground">{paymentLabels[paymentMethod]}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Despacho</span>
                  <span className="text-foreground">
                    {dispatchType === 'immediate'
                      ? 'Inmediato'
                      : scheduledDate
                        ? `${scheduledDate} · ${scheduledSlot}`
                        : 'Programado (sin fecha)'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-border">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="px-4 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors">
              Atrás
            </button>
          )}
          <button onClick={onClose}
            className={`px-4 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors ${step > 1 ? '' : 'flex-1'}`}>
            Cancelar
          </button>
          {step < 3 ? (
            <button
              onClick={step === 1 ? goToStep2 : goToStep3}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              Crear domicilio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminDomiciliosPage() {
  const { toast } = useToast();
  const [domicilios, setDomicilios] = useState<Domicilio[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'calendar' | 'list'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [dispatching, setDispatching] = useState<string | null>(null);

  const fetchDomicilios = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/domicilios');
      const data = await res.json();
      setDomicilios(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // Initial fetch + 30s polling
  useEffect(() => {
    fetchDomicilios();
    const interval = setInterval(fetchDomicilios, 30_000);
    return () => clearInterval(interval);
  }, [fetchDomicilios]);

  const selectedDomicilio = domicilios.find(d => d.id === selectedId) ?? null;

  const handleDispatch = async (id: string) => {
    setDispatching(id);
    try {
      const res = await fetch(`/api/admin/domicilios/${id}/dispatch`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Error al despachar');
      }
      toast({ title: 'Domicilio despachado exitosamente' });
      fetchDomicilios();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
    setDispatching(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 bg-muted/60 rounded-xl p-1">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="h-4 w-4" /> Lista
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'calendar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Calendario
          </button>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Nuevo domicilio
        </button>
      </div>

      {/* Content */}
      <div className={`flex gap-6 ${selectedDomicilio ? 'items-start' : ''}`}>
        <div className="flex-1 min-w-0">
          {view === 'list' ? (
            <ListView
              domicilios={domicilios}
              selectedId={selectedId}
              onSelect={id => setSelectedId(prev => prev === id ? null : id)}
              onDispatch={handleDispatch}
              dispatching={dispatching}
            />
          ) : (
            <CalendarView
              domicilios={domicilios}
              selectedId={selectedId}
              onSelect={id => setSelectedId(prev => prev === id ? null : id)}
            />
          )}
        </div>

        {/* Tracking panel */}
        {selectedDomicilio && (
          <TrackingPanel
            domicilio={selectedDomicilio}
            onClose={() => setSelectedId(null)}
            onDispatch={handleDispatch}
            dispatching={dispatching}
          />
        )}
      </div>

      {/* New domicilio form */}
      {showForm && (
        <NewDomicilioForm
          onClose={() => setShowForm(false)}
          onCreated={fetchDomicilios}
        />
      )}
    </div>
  );
}
