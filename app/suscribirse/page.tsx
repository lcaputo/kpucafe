'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Loader2, Coffee, MapPin, CreditCard, Check, ArrowLeft, Plus } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { useCardPayment, SavedPaymentMethod } from '@/hooks/useCardPayment';
import CardForm, { CardTokenResult } from '@/components/CardForm';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { useToast } from '@/hooks/use-toast';

interface Plan {
  id: string;
  name: string;
  frequencyLabel: string;
  frequency: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  imageUrl: string | null;
  variants: { id: string; weight: string; grind: string; priceModifier: number }[];
}

interface SavedAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  department: string;
  isDefault?: boolean;
}

function SubscribeWizardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { savedMethods, loadingMethods, fetchMethods, saveCard, chargeSaved } = useCardPayment();

  const planId = searchParams.get('plan');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({ fullName: '', phone: '', address: '', city: '', department: '' });
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth?next=/suscribirse${planId ? `?plan=${planId}` : ''}`);
    }
  }, [authLoading, user, router, planId]);

  // Fetch saved payment methods after auth resolves
  useEffect(() => {
    if (user) fetchMethods();
  }, [user]);

  // Load plan and products
  useEffect(() => {
    if (!planId || !user) return;
    Promise.all([
      fetch(`/api/subscription-plans/${planId}`).then(r => r.json()),
      fetch('/api/products?active=true').then(r => r.json()),
      fetch('/api/shipping-addresses').then(r => r.json()),
    ]).then(([planData, productsData, addressesData]) => {
      if (planData.message) {
        toast({ title: 'Plan no disponible', variant: 'destructive' });
        router.replace('/#suscripciones');
        return;
      }
      setPlan(planData);
      setProducts(Array.isArray(productsData) ? productsData : []);
      const addrs: SavedAddress[] = (Array.isArray(addressesData) ? addressesData : []).map((a: any) => ({
        id: a.id, label: a.label || 'Dirección',
        fullName: a.fullName, phone: a.phone,
        address: a.address, city: a.city, department: a.department,
        isDefault: a.isDefault,
      }));
      setSavedAddresses(addrs);
      if (addrs.length === 0) setShowNewAddress(true);
      else {
        const def = addrs.find(a => a.isDefault) || addrs[0];
        setSelectedAddressId(def.id);
      }
    }).catch(() => toast({ title: 'Error al cargar la información', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [planId, user, toast, router]);

  // Initialize payment method
  useEffect(() => {
    if (!loadingMethods) {
      if (savedMethods.length === 0) setShowCardForm(true);
      else {
        const def = savedMethods.find(m => m.isDefault) || savedMethods[0];
        setSelectedMethodId(def.id);
      }
    }
  }, [savedMethods, loadingMethods]);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedVariant = selectedProduct?.variants.find(v => v.id === selectedVariantId);

  const getShippingInfo = () => {
    if (selectedAddressId) {
      const addr = savedAddresses.find(a => a.id === selectedAddressId);
      return addr ? { address: addr.address, city: addr.city } : null;
    }
    if (showNewAddress && addressForm.address && addressForm.city) {
      return { address: addressForm.address, city: addressForm.city };
    }
    return null;
  };

  const handleActivate = async (methodId: string) => {
    if (!plan || !selectedProductId || !planId) return;
    const shipping = getShippingInfo();
    if (!shipping) {
      toast({ title: 'Dirección de entrega requerida', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    try {
      // Create subscription
      const subRes = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          productId: selectedProductId,
          variantId: selectedVariantId || null,
          paymentMethodId: methodId,
          shippingAddress: shipping.address,
          shippingCity: shipping.city,
        }),
      });
      const sub = await subRes.json();
      if (!subRes.ok) throw new Error(sub.message || 'Error al crear suscripción');

      // Charge first cycle using subscriptionId
      const chargeRes = await fetch(`/api/payment-methods/${methodId}/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: plan.price, subscriptionId: sub.id }),
      });
      const charge = await chargeRes.json();
      if (!chargeRes.ok) throw new Error(charge.message || 'Error al procesar el pago');

      if (charge.status === 'approved') {
        toast({ title: '¡Suscripción activada!', description: 'Tu primer envío está en camino.' });
      } else if (charge.status === 'rejected') {
        throw new Error(charge.message || 'Pago rechazado. Verifica tu tarjeta.');
      } else {
        toast({ title: 'Pago pendiente', description: 'Te notificaremos cuando se confirme.' });
      }
      router.push('/mis-suscripciones');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardTokenized = async (token: CardTokenResult) => {
    setIsProcessing(true);
    try {
      const saved = await saveCard(token);
      setSelectedMethodId(saved.id);
      setShowCardForm(false);
      await handleActivate(saved.id);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setIsProcessing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!planId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Selecciona un plan para continuar.</p>
      </div>
    );
  }

  if (!plan && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Plan no encontrado.</p>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-5 w-5" /> Volver
          </button>

          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Activar suscripción</h1>
          <p className="text-muted-foreground mb-6">{plan.name} · {plan.frequencyLabel} · ${plan.price.toLocaleString('es-CO')} COP</p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {([1, 2, 3] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                {i < 2 && <div className="h-px flex-1 bg-border" />}
              </div>
            ))}
          </div>

          {/* Step 1: Choose coffee */}
          {step === 1 && (
            <div className="bg-card rounded-2xl p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <Coffee className="h-5 w-5 text-primary" /> Elige tu café
              </h2>
              {products.length === 0 ? (
                <p className="text-muted-foreground">No hay productos disponibles.</p>
              ) : (
                <div className="space-y-3">
                  {products.map(p => (
                    <div
                      key={p.id}
                      onClick={() => { setSelectedProductId(p.id); setSelectedVariantId(null); }}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedProductId === p.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                    >
                      {p.imageUrl && (
                        <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden">
                          <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="56px" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{p.name}</p>
                        {selectedProductId === p.id && p.variants.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {p.variants.map(v => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={e => { e.stopPropagation(); setSelectedVariantId(v.id); }}
                                className={`px-3 py-1 rounded-lg text-xs border transition-all ${selectedVariantId === v.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'}`}
                              >
                                {v.weight} · {v.grind}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedProductId === p.id && <Check className="h-5 w-5 text-primary flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selectedProductId}
                className="w-full mt-6 btn-kpu disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          )}

          {/* Step 2: Shipping address */}
          {step === 2 && (
            <div className="bg-card rounded-2xl p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> Dirección de entrega
              </h2>
              {savedAddresses.length > 0 && !showNewAddress && (
                <div className="space-y-2 mb-4">
                  {savedAddresses.map(addr => (
                    <div
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedAddressId === addr.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selectedAddressId === addr.id ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}>
                        {selectedAddressId === addr.id && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{addr.label} — {addr.fullName}</p>
                        <p className="text-xs text-muted-foreground">{addr.address}, {addr.city}</p>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setShowNewAddress(true); setSelectedAddressId(null); }}
                    className="flex items-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Nueva dirección
                  </button>
                </div>
              )}
              {showNewAddress && (
                <div className="space-y-3 mb-4">
                  {[
                    { name: 'fullName', label: 'Nombre completo', placeholder: 'Nombre del destinatario' },
                    { name: 'phone', label: 'Teléfono', placeholder: '300 123 4567' },
                    { name: 'address', label: 'Dirección', placeholder: 'Calle, número, apto' },
                    { name: 'city', label: 'Ciudad', placeholder: 'Medellín' },
                    { name: 'department', label: 'Departamento', placeholder: 'Antioquia' },
                  ].map(field => (
                    <div key={field.name}>
                      <label className="block text-sm font-medium text-foreground mb-1">{field.label}</label>
                      <input
                        type="text"
                        value={addressForm[field.name as keyof typeof addressForm]}
                        onChange={e => setAddressForm(f => ({ ...f, [field.name]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      />
                    </div>
                  ))}
                  {savedAddresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setShowNewAddress(false); setSelectedAddressId(savedAddresses[0].id); }}
                      className="text-sm text-primary hover:underline"
                    >
                      Usar dirección guardada
                    </button>
                  )}
                </div>
              )}
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors">
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!selectedAddressId && !(showNewAddress && addressForm.address && addressForm.city)}
                  className="flex-1 btn-kpu disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment + confirm */}
          {step === 3 && (
            <div className="bg-card rounded-2xl p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" /> Método de pago
              </h2>

              {/* Summary */}
              <div className="bg-muted/50 rounded-xl p-4 mb-4 text-sm space-y-1">
                <p><span className="text-muted-foreground">Plan:</span> <span className="font-medium">{plan.name}</span></p>
                <p><span className="text-muted-foreground">Café:</span> <span className="font-medium">{selectedProduct?.name}{selectedVariant ? ` · ${selectedVariant.weight} ${selectedVariant.grind}` : ''}</span></p>
                <p><span className="text-muted-foreground">Frecuencia:</span> <span className="font-medium">{plan.frequencyLabel}</span></p>
                <p><span className="text-muted-foreground">Monto por envío:</span> <span className="font-bold text-primary">${plan.price.toLocaleString('es-CO')} COP</span></p>
              </div>

              {/* Saved methods */}
              {!showCardForm && savedMethods.length > 0 && (
                <div className="space-y-3 mb-4">
                  {savedMethods.map(m => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMethodId(m.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedMethodId === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selectedMethodId === m.id ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}>
                        {selectedMethodId === m.id && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium capitalize">{m.franchise} •••• {m.mask.slice(-4)}</p>
                        <p className="text-xs text-muted-foreground">Vence {m.expMonth}/{m.expYear}</p>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setShowCardForm(true); setSelectedMethodId(null); }}
                    className="flex items-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Agregar tarjeta
                  </button>
                </div>
              )}

              {showCardForm && (
                <CardForm
                  onSuccess={handleCardTokenized}
                  submitLabel={`Activar y pagar $${plan.price.toLocaleString('es-CO')}`}
                  loading={isProcessing}
                  showSaveOption={false}
                />
              )}

              {!showCardForm && selectedMethodId && (
                <div className="flex gap-3 mt-4">
                  <button type="button" onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors">
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => handleActivate(selectedMethodId)}
                    disabled={isProcessing}
                    className="flex-1 btn-kpu flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                    Activar suscripción
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SubscribeWizardInner />
    </Suspense>
  );
}
