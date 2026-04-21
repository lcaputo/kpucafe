'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  CreditCard,
  Truck,
  ShoppingBag,
  Loader2,
  MapPin,
  Plus,
  Check,
  AlertCircle,
  User,
  Ticket,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useCart, useAuth } from '@/components/providers';
import CardForm, { CardTokenResult } from '@/components/CardForm';
import { useCardPayment, SavedPaymentMethod } from '@/hooks/useCardPayment';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/header';
import Footer from '@/components/footer';

interface ShippingForm {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  address: string;
  city: string;
  department: string;
  postalCode: string;
  notes: string;
}

interface SavedAddress {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  department: string;
  postal_code: string | null;
  is_default: boolean;
}

interface FormErrors {
  [key: string]: string;
}

const DEPARTMENTS = [
  'Amazonas',
  'Antioquia',
  'Arauca',
  'Atlantico',
  'Bogota D.C.',
  'Bolivar',
  'Boyaca',
  'Caldas',
  'Caqueta',
  'Casanare',
  'Cauca',
  'Cesar',
  'Choco',
  'Cordoba',
  'Cundinamarca',
  'Guainia',
  'Guaviare',
  'Huila',
  'La Guajira',
  'Magdalena',
  'Meta',
  'Narino',
  'Norte de Santander',
  'Putumayo',
  'Quindio',
  'Risaralda',
  'San Andres y Providencia',
  'Santander',
  'Sucre',
  'Tolima',
  'Valle del Cauca',
  'Vaupes',
  'Vichada',
];

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Nombre completo',
  phone: 'Telefono',
  email: 'Correo electronico',
  password: 'Contrasena',
  address: 'Direccion',
  city: 'Ciudad',
  department: 'Departamento',
};

export default function Checkout() {
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();
  const { user, profile, signUp, signIn } = useAuth();
  const { savedMethods, loadingMethods, fetchMethods, saveCard, chargeSaved } = useCardPayment();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [addressLabel, setAddressLabel] = useState('Casa');
  const [step, setStep] = useState<'account' | 'shipping' | 'review'>('shipping');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
  } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  // Payment method state
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [saveCardOption, setSaveCardOption] = useState(true);

  const [form, setForm] = useState<ShippingForm>({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    address: '',
    city: '',
    department: '',
    postalCode: '',
    notes: '',
  });

  // Determine if user needs account creation
  const needsAccount = !user;

  // Pre-fill form with user profile data
  useEffect(() => {
    if (profile) {
      setForm((prev) => ({
        ...prev,
        fullName: profile.full_name || prev.fullName,
        phone: profile.phone || prev.phone,
        address: profile.address || prev.address,
        city: profile.city || prev.city,
        department: profile.department || prev.department,
        postalCode: profile.postal_code || prev.postalCode,
      }));
    }
    if (user?.email) {
      setForm((prev) => ({ ...prev, email: user.email || prev.email }));
      setStep('shipping');
    } else {
      setStep('account');
    }
  }, [profile, user]);

  // Fetch saved addresses
  useEffect(() => {
    if (user) {
      fetchSavedAddresses();
    }
  }, [user]);

  // Fetch saved payment methods after auth resolves
  useEffect(() => {
    if (user) fetchMethods();
  }, [user]);

  // Initialize payment method selection
  useEffect(() => {
    if (!loadingMethods && user) {
      if (savedMethods.length === 0) {
        setShowCardForm(true);
      } else {
        const def = savedMethods.find(m => m.isDefault) || savedMethods[0];
        setSelectedMethodId(def.id);
        setShowCardForm(false);
      }
    }
  }, [savedMethods, loadingMethods, user]);

  const fetchSavedAddresses = async () => {
    try {
      const res = await fetch('/api/shipping-addresses');
      const data = await res.json();
      const mapped = (data || []).map((a: any) => ({
        id: a.id,
        label: a.label,
        full_name: a.fullName,
        phone: a.phone,
        address: a.address,
        city: a.city,
        department: a.department,
        postal_code: a.postalCode,
        is_default: a.isDefault,
      }));

      if (mapped.length > 0) {
        setSavedAddresses(mapped);
        const defaultAddr = mapped.find((a: any) => a.is_default) || mapped[0];
        if (defaultAddr) {
          selectAddress(defaultAddr);
        }
      } else {
        setShowNewAddress(true);
      }
    } catch {
      setShowNewAddress(true);
    }
  };

  const selectAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    setShowNewAddress(false);
    setEditingAddressId(null);
    setForm((prev) => ({
      ...prev,
      fullName: addr.full_name,
      phone: addr.phone,
      address: addr.address,
      city: addr.city,
      department: addr.department,
      postalCode: addr.postal_code || '',
    }));
  };

  const startEditAddress = (addr: SavedAddress) => {
    setEditingAddressId(addr.id);
    setSelectedAddressId(addr.id);
    setShowNewAddress(false);
    setAddressLabel(addr.label);
    setForm((prev) => ({
      ...prev,
      fullName: addr.full_name,
      phone: addr.phone,
      address: addr.address,
      city: addr.city,
      department: addr.department,
      postalCode: addr.postal_code || '',
    }));
  };

  const saveEditAddress = async () => {
    if (!validateForm() || !editingAddressId) return;
    try {
      await fetch(`/api/shipping-addresses/${editingAddressId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: addressLabel,
          fullName: form.fullName,
          phone: form.phone,
          address: form.address,
          city: form.city,
          department: form.department,
          postalCode: form.postalCode || null,
        }),
      });
      toast({ title: 'Direccion actualizada' });
      setEditingAddressId(null);
      fetchSavedAddresses();
    } catch {}
  };

  const deleteAddress = async (id: string) => {
    try {
      await fetch(`/api/shipping-addresses/${id}`, { method: 'DELETE' });
      toast({ title: 'Direccion eliminada' });
      const remaining = savedAddresses.filter((a) => a.id !== id);
      setSavedAddresses(remaining);
      if (selectedAddressId === id) {
        if (remaining.length > 0) {
          selectAddress(remaining[0]);
        } else {
          setSelectedAddressId(null);
          setShowNewAddress(true);
          setForm((prev) => ({ ...prev, address: '', city: '', department: '', postalCode: '' }));
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (items.length === 0) router.push('/');
  }, [items.length, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const required =
      needsAccount && step === 'account'
        ? ['fullName', 'email', 'password']
        : ['fullName', 'phone', 'address', 'city', 'department'];

    for (const field of required) {
      if (!form[field as keyof ShippingForm]?.trim()) {
        newErrors[field] = `${FIELD_LABELS[field] || field} es requerido`;
      }
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Correo electronico no valido';
    }
    if (needsAccount && form.password && form.password.length < 6) {
      newErrors.password = 'Minimo 6 caracteres';
    }
    if (form.phone && !/^\d{7,15}$/.test(form.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Telefono no valido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAccountStep = async () => {
    if (!validateForm()) return;
    setIsProcessing(true);

    try {
      // Try sign in first
      try {
        await signIn(form.email, form.password);
        toast({ title: 'Bienvenido!', description: 'Sesion iniciada correctamente.' });
        setStep('shipping');
        setIsProcessing(false);
        return;
      } catch {
        // Sign in failed, try sign up
      }

      // If sign in fails, create account
      try {
        await signUp(form.email, form.password, form.fullName);
        toast({ title: 'Cuenta creada', description: 'Tu cuenta ha sido creada automaticamente.' });
        setStep('shipping');
      } catch (signUpErr: any) {
        if (signUpErr.message.includes('already registered')) {
          setErrors({ email: 'Este correo ya esta registrado. Verifica tu contrasena.' });
        } else {
          setErrors({ email: signUpErr.message });
        }
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper: save address if needed (shared between payment handlers)
  const maybeSaveAddress = async () => {
    if (user && saveAddress && showNewAddress) {
      await fetch('/api/shipping-addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: addressLabel,
          fullName: form.fullName,
          phone: form.phone,
          address: form.address,
          city: form.city,
          department: form.department,
          postalCode: form.postalCode || null,
          isDefault: savedAddresses.length === 0,
        }),
      });
    }
  };

  // Helper: build order payload
  const buildOrderPayload = () => ({
    total: finalTotal,
    shippingName: form.fullName,
    shippingPhone: form.phone,
    shippingAddress: form.address,
    shippingCity: form.city,
    shippingDepartment: form.department,
    shippingPostalCode: form.postalCode || null,
    notes: form.notes || null,
    couponId: appliedCoupon?.id || null,
    discountAmount: discountAmount || 0,
    items: items.map((item: any) => ({
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      variantInfo: `${item.weight || ''} - ${item.grind || ''}`.trim().replace(/^-\s*|-\s*$/g, '').trim(),
    })),
  });

  // Called when user clicks "Pagar" with a saved card
  const handlePaymentWithSavedCard = async () => {
    if (!validateForm()) return;
    setIsProcessing(true);
    try {
      await maybeSaveAddress();

      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildOrderPayload()),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.message || 'Error al crear pedido');

      const result = await chargeSaved(selectedMethodId!, finalTotal, order.id);
      clearCart();
      router.push(`/pago-respuesta?status=${result.status}&orderId=${order.id}&ref=${result.epaycoRef || ''}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Called when CardForm succeeds (new card tokenized)
  const handleCardTokenized = async (token: CardTokenResult) => {
    if (!validateForm()) return;
    setIsProcessing(true);
    try {
      await maybeSaveAddress();

      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildOrderPayload()),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.message || 'Error al crear pedido');

      // Save card to charge it (we always save temporarily to use chargeSaved)
      const saved = await saveCard(token);
      const methodId = saved.id;

      const result = await chargeSaved(methodId, finalTotal, order.id);

      // Clean up temporary card if user didn't want to save it
      if (!saveCardOption || !user) {
        await fetch(`/api/payment-methods/${methodId}`, { method: 'DELETE' });
      }

      clearCart();
      router.push(`/pago-respuesta?status=${result.status}&orderId=${order.id}&ref=${result.epaycoRef || ''}`);
    } catch (err: any) {
      toast({ title: 'Error al pagar', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.message || 'Cupon no valido');
        setCouponLoading(false);
        return;
      }
      if ((data.minOrderAmount || 0) > totalPrice) {
        setCouponError(`Compra minima de $${(data.minOrderAmount || 0).toLocaleString('es-CO')}`);
        setCouponLoading(false);
        return;
      }
      setAppliedCoupon({
        id: data.id,
        code: data.code,
        discount_type: data.discountType,
        discount_value: data.discountValue,
      });
      toast({ title: 'Cupon aplicado!' });
    } catch {
      setCouponError('Cupon no valido');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const shippingCost = totalPrice >= 100000 ? 0 : 12000;
  const discountAmount = appliedCoupon
    ? appliedCoupon.discount_type === 'percentage'
      ? Math.round((totalPrice * appliedCoupon.discount_value) / 100)
      : appliedCoupon.discount_value
    : 0;
  const finalTotal = Math.max(0, totalPrice - discountAmount + shippingCost);

  const inputClass = (field: string) =>
    `w-full px-4 py-3 rounded-xl border ${errors[field] ? 'border-destructive ring-2 ring-destructive/20' : 'border-border'} bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Volver
          </button>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-6">Finalizar Compra</h1>

          {/* Steps indicator */}
          <div className="flex items-center gap-2 mb-8">
            <StepBadge number={1} label="Cuenta" active={step === 'account'} done={!needsAccount || step !== 'account'} />
            <div className="h-px flex-1 bg-border" />
            <StepBadge
              number={2}
              label="Envio"
              active={step === 'shipping'}
              done={step === 'review'}
            />
            <div className="h-px flex-1 bg-border" />
            <StepBadge number={3} label="Pago" active={step === 'review'} done={false} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6 xl:gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Account step */}
              {step === 'account' && (
                <div className="bg-card rounded-2xl p-5 sm:p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-6">
                    <User className="h-6 w-6 text-primary" />
                    <h2 className="font-display text-lg sm:text-xl font-bold text-card-foreground">Tu Cuenta</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ingresa tus datos. Si no tienes cuenta, la crearemos automaticamente.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-1.5">Nombre completo *</label>
                      <input
                        type="text"
                        name="fullName"
                        value={form.fullName}
                        onChange={handleInputChange}
                        className={inputClass('fullName')}
                        placeholder="Tu nombre completo"
                      />
                      {errors.fullName && <ErrorMsg msg={errors.fullName} />}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Email *</label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleInputChange}
                        className={inputClass('email')}
                        placeholder="tu@email.com"
                      />
                      {errors.email && <ErrorMsg msg={errors.email} />}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Contrasena *</label>
                      <input
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleInputChange}
                        className={inputClass('password')}
                        placeholder="Minimo 6 caracteres"
                      />
                      {errors.password && <ErrorMsg msg={errors.password} />}
                    </div>
                  </div>

                  <button
                    onClick={handleAccountStep}
                    disabled={isProcessing}
                    className="w-full mt-6 btn-kpu flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                    Continuar
                  </button>
                </div>
              )}

              {/* Shipping step */}
              {step === 'shipping' && (
                <div className="bg-card rounded-2xl p-5 sm:p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-6">
                    <Truck className="h-6 w-6 text-primary" />
                    <h2 className="font-display text-lg sm:text-xl font-bold text-card-foreground">Datos de Envio</h2>
                  </div>

                  {/* Saved addresses - compact list */}
                  {savedAddresses.length > 0 && !editingAddressId && (
                    <div className="mb-5 space-y-2">
                      <p className="text-sm font-medium text-foreground mb-2">Direcciones guardadas</p>
                      {savedAddresses.map((addr) => {
                        const isSelected = selectedAddressId === addr.id && !showNewAddress;
                        return (
                          <div
                            key={addr.id}
                            onClick={() => selectAddress(addr)}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/40'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">{addr.label}</span>
                                <span className="text-xs text-muted-foreground">- {addr.full_name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {addr.address}, {addr.city}, {addr.department}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={(e) => { e.stopPropagation(); startEditAddress(addr); }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteAddress(addr.id); }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {!showNewAddress && (
                        <button
                          onClick={() => {
                            setShowNewAddress(true);
                            setSelectedAddressId(null);
                            setForm((prev) => ({
                              ...prev,
                              address: '',
                              city: '',
                              department: '',
                              postalCode: '',
                            }));
                            setAddressLabel('Casa');
                          }}
                          className="flex items-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-all text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-4 w-4" />
                          Agregar nueva direccion
                        </button>
                      )}
                    </div>
                  )}

                  {/* Address form - for new address, editing, or no saved addresses */}
                  {(showNewAddress || editingAddressId || savedAddresses.length === 0) && (
                    <div className="space-y-4">
                      {editingAddressId && (
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-foreground">Editando direccion</p>
                          <button
                            onClick={() => {
                              setEditingAddressId(null);
                              const addr = savedAddresses.find(a => a.id === selectedAddressId);
                              if (addr) selectAddress(addr);
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}

                      {(editingAddressId || (showNewAddress && saveAddress && user)) && (
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Etiqueta</label>
                          <input
                            type="text"
                            value={addressLabel}
                            onChange={(e) => setAddressLabel(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Ej: Casa, Oficina"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Nombre completo *</label>
                          <input
                            type="text"
                            name="fullName"
                            value={form.fullName}
                            onChange={handleInputChange}
                            className={inputClass('fullName')}
                            placeholder="Nombre del destinatario"
                          />
                          {errors.fullName && <ErrorMsg msg={errors.fullName} />}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Telefono *</label>
                          <input
                            type="tel"
                            name="phone"
                            value={form.phone}
                            onChange={handleInputChange}
                            className={inputClass('phone')}
                            placeholder="300 123 4567"
                          />
                          {errors.phone && <ErrorMsg msg={errors.phone} />}
                        </div>
                        {!user && (
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-foreground mb-1.5">Email *</label>
                            <input
                              type="email"
                              name="email"
                              value={form.email}
                              onChange={handleInputChange}
                              className={inputClass('email')}
                              placeholder="tu@email.com"
                            />
                            {errors.email && <ErrorMsg msg={errors.email} />}
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-foreground mb-1.5">Direccion *</label>
                          <input
                            type="text"
                            name="address"
                            value={form.address}
                            onChange={handleInputChange}
                            className={inputClass('address')}
                            placeholder="Calle, numero, apartamento, etc."
                          />
                          {errors.address && <ErrorMsg msg={errors.address} />}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Departamento *</label>
                          <select
                            name="department"
                            value={form.department}
                            onChange={handleInputChange}
                            className={inputClass('department')}
                          >
                            <option value="">Selecciona...</option>
                            {DEPARTMENTS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                          {errors.department && <ErrorMsg msg={errors.department} />}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Ciudad *</label>
                          <input
                            type="text"
                            name="city"
                            value={form.city}
                            onChange={handleInputChange}
                            className={inputClass('city')}
                            placeholder="Ciudad"
                          />
                          {errors.city && <ErrorMsg msg={errors.city} />}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Codigo Postal</label>
                          <input
                            type="text"
                            name="postalCode"
                            value={form.postalCode}
                            onChange={handleInputChange}
                            className={inputClass('postalCode')}
                            placeholder="Opcional"
                          />
                        </div>
                      </div>

                      {user && showNewAddress && !editingAddressId && (
                        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={saveAddress}
                            onChange={(e) => setSaveAddress(e.target.checked)}
                            className="rounded border-border"
                          />
                          Guardar esta direccion
                        </label>
                      )}

                      {editingAddressId && (
                        <button
                          onClick={saveEditAddress}
                          className="w-full btn-kpu flex items-center justify-center gap-2"
                        >
                          <Check className="h-4 w-4" />
                          Guardar cambios
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-foreground mb-1.5">Notas adicionales</label>
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={handleInputChange}
                      rows={2}
                      className={`${inputClass('notes')} resize-none`}
                      placeholder="Instrucciones especiales..."
                    />
                  </div>

                  {!editingAddressId && (
                    <button
                      onClick={() => {
                        if (validateForm()) setStep('review');
                      }}
                      className="w-full mt-5 btn-kpu flex items-center justify-center gap-2"
                    >
                      Revisar y Pagar
                    </button>
                  )}
                </div>
              )}

              {/* Review step */}
              {step === 'review' && (
                <div className="space-y-4">
                  <div className="bg-card rounded-2xl p-5 sm:p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        Direccion de Envio
                      </h3>
                      <button onClick={() => setStep('shipping')} className="text-sm text-primary hover:underline">
                        Editar
                      </button>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <p className="font-medium text-foreground">{form.fullName}</p>
                      <p className="text-sm text-muted-foreground">{form.phone}</p>
                      <p className="text-sm text-foreground">{form.address}</p>
                      <p className="text-sm text-foreground">
                        {form.city}, {form.department}
                      </p>
                      {form.notes && <p className="text-xs text-muted-foreground mt-2 italic">Nota: {form.notes}</p>}
                    </div>
                  </div>

                  <div className="bg-card rounded-2xl p-5 sm:p-6 shadow-lg">
                    <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                      Resumen del Pedido
                    </h3>
                    <div className="space-y-3 mb-4">
                      {items.map((item) => (
                        <div key={item.id} className="flex gap-3">
                          <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              sizes="64px"
                              className="object-cover rounded-lg"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.weight} - {item.grind}
                            </p>
                            <p className="text-sm text-foreground">
                              {item.quantity} x ${item.price.toLocaleString('es-CO')}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground whitespace-nowrap">
                            ${(item.quantity * item.price).toLocaleString('es-CO')}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Coupon */}
                    <div className="border-t border-border pt-4 mb-4">
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
                        <Ticket className="h-4 w-4 text-primary" />
                        Cupon de descuento
                      </p>
                      {appliedCoupon ? (
                        <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2">
                          <div>
                            <span className="font-mono font-semibold text-primary text-sm">{appliedCoupon.code}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              -
                              {appliedCoupon.discount_type === 'percentage'
                                ? `${appliedCoupon.discount_value}%`
                                : `$${appliedCoupon.discount_value.toLocaleString('es-CO')}`}
                            </span>
                          </div>
                          <button onClick={removeCoupon} className="p-1 text-muted-foreground hover:text-destructive">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponCode}
                            onChange={(e) => {
                              setCouponCode(e.target.value);
                              setCouponError('');
                            }}
                            placeholder="CODIGO"
                            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-mono uppercase focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                          <button
                            onClick={applyCoupon}
                            disabled={couponLoading}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
                          </button>
                        </div>
                      )}
                      {couponError && <p className="text-xs text-destructive mt-1">{couponError}</p>}
                    </div>

                    <div className="border-t border-border pt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="text-foreground">${totalPrice.toLocaleString('es-CO')}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Descuento</span>
                          <span className="text-green-600 font-medium">-${discountAmount.toLocaleString('es-CO')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Envio</span>
                        <span className="text-foreground">
                          {shippingCost === 0 ? (
                            <span className="text-green-600 font-medium">Gratis</span>
                          ) : (
                            `$${shippingCost.toLocaleString('es-CO')}`
                          )}
                        </span>
                      </div>
                      {shippingCost > 0 && (
                        <p className="text-xs text-muted-foreground">Envio gratis en compras mayores a $100.000</p>
                      )}
                      <div className="flex justify-between pt-2 border-t border-border">
                        <span className="font-semibold text-foreground">Total</span>
                        <span className="font-display text-xl font-bold text-primary">
                          ${finalTotal.toLocaleString('es-CO')}
                        </span>
                      </div>
                    </div>

                    {/* Payment method section */}
                    <div className="mt-6">
                      <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Metodo de Pago
                      </h4>

                      {/* Saved payment methods list */}
                      {!showCardForm && savedMethods.length > 0 && (
                        <div className="space-y-3 mb-4">
                          {savedMethods.map(m => (
                            <div
                              key={m.id}
                              onClick={() => setSelectedMethodId(m.id)}
                              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                selectedMethodId === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                selectedMethodId === m.id ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                              }`}>
                                {selectedMethodId === m.id && <Check className="h-3 w-3 text-primary-foreground" />}
                              </div>
                              <CreditCard className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium capitalize">{m.franchise} &bull;&bull;&bull;&bull; {m.mask.slice(-4)}</p>
                                <p className="text-xs text-muted-foreground">Vence {m.expMonth}/{m.expYear}</p>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => { setShowCardForm(true); setSelectedMethodId(null); }}
                            className="flex items-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Plus className="h-4 w-4" /> Usar otra tarjeta
                          </button>
                        </div>
                      )}

                      {/* New card form */}
                      {showCardForm && (
                        <div className="mb-4">
                          <CardForm
                            onSuccess={handleCardTokenized}
                            submitLabel={`Pagar $${finalTotal.toLocaleString('es-CO')}`}
                            loading={isProcessing}
                            showSaveOption={!!user}
                            saveCard={saveCardOption}
                            onSaveCardChange={setSaveCardOption}
                          />
                          {savedMethods.length > 0 && (
                            <button
                              type="button"
                              onClick={() => { setShowCardForm(false); setSelectedMethodId(savedMethods[0].id); }}
                              className="w-full mt-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Usar tarjeta guardada
                            </button>
                          )}
                        </div>
                      )}

                      {/* Pay button (only when saved card selected) */}
                      {!showCardForm && selectedMethodId && (
                        <button
                          type="button"
                          onClick={handlePaymentWithSavedCard}
                          disabled={isProcessing || loadingMethods}
                          className="w-full btn-kpu flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                        >
                          {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                          Pagar ${finalTotal.toLocaleString('es-CO')}
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>

            {/* Order Summary sidebar (visible on shipping/account steps) */}
            {step !== 'review' && (
              <div className="lg:col-span-1">
                <div className="bg-card rounded-2xl p-5 sm:p-6 shadow-lg sticky top-24">
                  <div className="flex items-center gap-3 mb-4">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    <h2 className="font-display text-lg font-bold text-card-foreground">Tu Pedido</h2>
                  </div>
                  <div className="space-y-3 mb-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="relative w-12 h-12 flex-shrink-0">
                          <Image src={item.image} alt={item.name} fill sizes="48px" className="object-cover rounded-lg" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.weight} - {item.grind}
                          </p>
                          <p className="text-xs text-foreground">
                            {item.quantity} x ${item.price.toLocaleString('es-CO')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${totalPrice.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Envio</span>
                      <span>
                        {shippingCost === 0 ? (
                          <span className="text-green-600 font-medium">Gratis</span>
                        ) : (
                          `$${shippingCost.toLocaleString('es-CO')}`
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span>Total</span>
                      <span className="font-display text-lg text-primary">${finalTotal.toLocaleString('es-CO')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function StepBadge({ number, label, active, done }: { number: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
          done
            ? 'bg-green-500 text-white'
            : active
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : number}
      </div>
      <span className={`text-sm font-medium hidden sm:inline ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="flex items-center gap-1 mt-1 text-xs text-destructive">
      <AlertCircle className="h-3 w-3" />
      {msg}
    </p>
  );
}
