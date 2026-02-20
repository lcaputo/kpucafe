import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useEpayco, EpaycoPaymentData } from "@/hooks/useEpayco";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Atlántico",
  "Bogotá D.C.",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Cundinamarca",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "San Andrés y Providencia",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada",
];

const FIELD_LABELS: Record<string, string> = {
  fullName: "Nombre completo",
  phone: "Teléfono",
  email: "Correo electrónico",
  password: "Contraseña",
  address: "Dirección",
  city: "Ciudad",
  department: "Departamento",
};

export default function Checkout() {
  const navigate = useNavigate();
  const { items, totalPrice, clearCart } = useCart();
  const { user, profile, signUp, signIn } = useAuth();
  const { isLoaded, isLoading: epaycoLoading, openCheckout } = useEpayco();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [addressLabel, setAddressLabel] = useState("Casa");
  const [step, setStep] = useState<"account" | "shipping" | "review">("shipping");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const [form, setForm] = useState<ShippingForm>({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    address: "",
    city: "",
    department: "",
    postalCode: "",
    notes: "",
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
      setStep("shipping");
    } else {
      setStep("account");
    }
  }, [profile, user]);

  // Fetch saved addresses
  useEffect(() => {
    if (user) {
      fetchSavedAddresses();
    }
  }, [user]);

  const fetchSavedAddresses = async () => {
    const { data } = await supabase.from("shipping_addresses").select("*").order("is_default", { ascending: false });

    if (data && data.length > 0) {
      setSavedAddresses(data as SavedAddress[]);
      const defaultAddr = data.find((a: any) => a.is_default) || data[0];
      if (defaultAddr) {
        selectAddress(defaultAddr as SavedAddress);
      }
    } else {
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
      postalCode: addr.postal_code || "",
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
      postalCode: addr.postal_code || "",
    }));
  };

  const saveEditAddress = async () => {
    if (!validateForm() || !editingAddressId) return;
    const { error } = await supabase
      .from("shipping_addresses")
      .update({
        label: addressLabel,
        full_name: form.fullName,
        phone: form.phone,
        address: form.address,
        city: form.city,
        department: form.department,
        postal_code: form.postalCode || null,
      })
      .eq("id", editingAddressId);
    if (!error) {
      toast({ title: "Dirección actualizada" });
      setEditingAddressId(null);
      fetchSavedAddresses();
    }
  };

  const deleteAddress = async (id: string) => {
    const { error } = await supabase.from("shipping_addresses").delete().eq("id", id);
    if (!error) {
      toast({ title: "Dirección eliminada" });
      const remaining = savedAddresses.filter((a) => a.id !== id);
      setSavedAddresses(remaining);
      if (selectedAddressId === id) {
        if (remaining.length > 0) {
          selectAddress(remaining[0]);
        } else {
          setSelectedAddressId(null);
          setShowNewAddress(true);
          setForm((prev) => ({ ...prev, address: "", city: "", department: "", postalCode: "" }));
        }
      }
    }
  };

  useEffect(() => {
    if (items.length === 0) navigate("/");
  }, [items.length, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const required =
      needsAccount && step === "account"
        ? ["fullName", "email", "password"]
        : ["fullName", "phone", "address", "city", "department"];

    for (const field of required) {
      if (!form[field as keyof ShippingForm]?.trim()) {
        newErrors[field] = `${FIELD_LABELS[field] || field} es requerido`;
      }
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Correo electrónico no válido";
    }
    if (needsAccount && form.password && form.password.length < 6) {
      newErrors.password = "Mínimo 6 caracteres";
    }
    if (form.phone && !/^\d{7,15}$/.test(form.phone.replace(/\s/g, ""))) {
      newErrors.phone = "Teléfono no válido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAccountStep = async () => {
    if (!validateForm()) return;
    setIsProcessing(true);

    try {
      // Try sign in first
      const { error: signInErr } = await signIn(form.email, form.password);
      if (!signInErr) {
        toast({ title: "¡Bienvenido!", description: "Sesión iniciada correctamente." });
        setStep("shipping");
        setIsProcessing(false);
        return;
      }

      // If sign in fails, create account
      const { error: signUpErr } = await signUp(form.email, form.password, form.fullName);
      if (signUpErr) {
        if (signUpErr.message.includes("already registered")) {
          setErrors({ email: "Este correo ya está registrado. Verifica tu contraseña." });
        } else {
          setErrors({ email: signUpErr.message });
        }
        setIsProcessing(false);
        return;
      }

      toast({ title: "Cuenta creada", description: "Tu cuenta ha sido creada automáticamente." });
      setStep("shipping");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (!validateForm()) return;
    if (!isLoaded) {
      toast({ title: "Cargando...", description: "Espera mientras se carga el sistema de pagos" });
      return;
    }

    setIsProcessing(true);

    try {
      // Save address if requested and user is logged in
      if (user && saveAddress && showNewAddress) {
        await supabase.from("shipping_addresses").insert({
          user_id: user.id,
          label: addressLabel,
          full_name: form.fullName,
          phone: form.phone,
          address: form.address,
          city: form.city,
          department: form.department,
          postal_code: form.postalCode || null,
          is_default: savedAddresses.length === 0,
        });
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user?.id || null,
          total: finalTotal,
          shipping_name: form.fullName,
          shipping_phone: form.phone,
          shipping_address: form.address,
          shipping_city: form.city,
          shipping_department: form.department,
          shipping_postal_code: form.postalCode,
          notes: form.notes,
          status: "pending",
          coupon_id: appliedCoupon?.id || null,
          discount_amount: discountAmount,
        } as any)
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        variant_info: `${item.weight} - ${item.grind}`,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      const paymentData: EpaycoPaymentData = {
        name: "Pedido KPU Café",
        description: `Pedido #${order.id.slice(0, 8)}`,
        invoice: order.id,
        currency: "cop",
        amount: finalTotal.toString(),
        tax_base: "0",
        tax: "0",
        country: "co",
        lang: "es",
        external: "false",
        confirmation: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/epayco-webhook`,
        response: `${window.location.origin}/pago-respuesta`,
        name_billing: form.fullName,
        address_billing: form.address,
        mobilephone_billing: form.phone,
        email_billing: form.email || user?.email || "",
        extra1: order.id,
        extra2: user?.id || "guest",
      };
      // Increment coupon usage
      if (appliedCoupon) {
        const { data: cd } = await supabase.from("coupons").select("current_uses").eq("id", appliedCoupon.id).single();
        if (cd) {
          await supabase
            .from("coupons")
            .update({ current_uses: ((cd as any).current_uses || 0) + 1 } as any)
            .eq("id", appliedCoupon.id);
        }
      }

      openCheckout(paymentData);
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast({
        title: "Error al procesar pedido",
        description: error.message || "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", couponCode.toUpperCase().trim())
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      setCouponError("Cupón no válido");
      setCouponLoading(false);
      return;
    }
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setCouponError("Este cupón ha expirado");
      setCouponLoading(false);
      return;
    }
    if (data.max_uses && (data.current_uses || 0) >= data.max_uses) {
      setCouponError("Este cupón ya alcanzó su límite de usos");
      setCouponLoading(false);
      return;
    }
    if ((data.min_order_amount || 0) > totalPrice) {
      setCouponError(`Compra mínima de $${(data.min_order_amount || 0).toLocaleString("es-CO")}`);
      setCouponLoading(false);
      return;
    }
    setAppliedCoupon({
      id: data.id,
      code: data.code,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
    });
    setCouponLoading(false);
    toast({ title: "¡Cupón aplicado!" });
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  const shippingCost = totalPrice >= 100000 ? 0 : 12000;
  const discountAmount = appliedCoupon
    ? appliedCoupon.discount_type === "percentage"
      ? Math.round((totalPrice * appliedCoupon.discount_value) / 100)
      : appliedCoupon.discount_value
    : 0;
  const finalTotal = Math.max(0, totalPrice - discountAmount + shippingCost);

  const inputClass = (field: string) =>
    `w-full px-4 py-3 rounded-xl border ${errors[field] ? "border-destructive ring-2 ring-destructive/20" : "border-border"} bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Volver
          </button>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-6">Finalizar Compra</h1>

          {/* Steps indicator */}
          <div className="flex items-center gap-2 mb-8">
            <StepBadge number={1} label="Cuenta" active={step === "account"} done={!needsAccount || step !== "account"} />
            <div className="h-px flex-1 bg-border" />
            <StepBadge
              number={2}
              label="Envío"
              active={step === "shipping"}
              done={step === "review"}
            />
            <div className="h-px flex-1 bg-border" />
            <StepBadge number={3} label="Pago" active={step === "review"} done={false} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6 xl:gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Account step */}
              {step === "account" && (
                <div className="bg-card rounded-2xl p-5 sm:p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-6">
                    <User className="h-6 w-6 text-primary" />
                    <h2 className="font-display text-lg sm:text-xl font-bold text-card-foreground">Tu Cuenta</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ingresa tus datos. Si no tienes cuenta, la crearemos automáticamente.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-1.5">Nombre completo *</label>
                      <input
                        type="text"
                        name="fullName"
                        value={form.fullName}
                        onChange={handleInputChange}
                        className={inputClass("fullName")}
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
                        className={inputClass("email")}
                        placeholder="tu@email.com"
                      />
                      {errors.email && <ErrorMsg msg={errors.email} />}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Contraseña *</label>
                      <input
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleInputChange}
                        className={inputClass("password")}
                        placeholder="Mínimo 6 caracteres"
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
              {step === "shipping" && (
                <div className="bg-card rounded-2xl p-5 sm:p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-6">
                    <Truck className="h-6 w-6 text-primary" />
                    <h2 className="font-display text-lg sm:text-xl font-bold text-card-foreground">Datos de Envío</h2>
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
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">{addr.label}</span>
                                <span className="text-xs text-muted-foreground">· {addr.full_name}</span>
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
                              address: "",
                              city: "",
                              department: "",
                              postalCode: "",
                            }));
                            setAddressLabel("Casa");
                          }}
                          className="flex items-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-all text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-4 w-4" />
                          Agregar nueva dirección
                        </button>
                      )}
                    </div>
                  )}

                  {/* Address form - for new address, editing, or no saved addresses */}
                  {(showNewAddress || editingAddressId || savedAddresses.length === 0) && (
                    <div className="space-y-4">
                      {editingAddressId && (
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-foreground">Editando dirección</p>
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
                            className={inputClass("fullName")}
                            placeholder="Nombre del destinatario"
                          />
                          {errors.fullName && <ErrorMsg msg={errors.fullName} />}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Teléfono *</label>
                          <input
                            type="tel"
                            name="phone"
                            value={form.phone}
                            onChange={handleInputChange}
                            className={inputClass("phone")}
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
                              className={inputClass("email")}
                              placeholder="tu@email.com"
                            />
                            {errors.email && <ErrorMsg msg={errors.email} />}
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-foreground mb-1.5">Dirección *</label>
                          <input
                            type="text"
                            name="address"
                            value={form.address}
                            onChange={handleInputChange}
                            className={inputClass("address")}
                            placeholder="Calle, número, apartamento, etc."
                          />
                          {errors.address && <ErrorMsg msg={errors.address} />}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Departamento *</label>
                          <select
                            name="department"
                            value={form.department}
                            onChange={handleInputChange}
                            className={inputClass("department")}
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
                            className={inputClass("city")}
                            placeholder="Ciudad"
                          />
                          {errors.city && <ErrorMsg msg={errors.city} />}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Código Postal</label>
                          <input
                            type="text"
                            name="postalCode"
                            value={form.postalCode}
                            onChange={handleInputChange}
                            className={inputClass("postalCode")}
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
                          Guardar esta dirección
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
                      className={`${inputClass("notes")} resize-none`}
                      placeholder="Instrucciones especiales..."
                    />
                  </div>

                  {!editingAddressId && (
                    <button
                      onClick={() => {
                        if (validateForm()) setStep("review");
                      }}
                      className="w-full mt-5 btn-kpu flex items-center justify-center gap-2"
                    >
                      Revisar y Pagar
                    </button>
                  )}
                </div>
              )}

              {/* Review step */}
              {step === "review" && (
                <div className="space-y-4">
                  <div className="bg-card rounded-2xl p-5 sm:p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        Dirección de Envío
                      </h3>
                      <button onClick={() => setStep("shipping")} className="text-sm text-primary hover:underline">
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
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.weight} • {item.grind}
                            </p>
                            <p className="text-sm text-foreground">
                              {item.quantity} x ${item.price.toLocaleString("es-CO")}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground whitespace-nowrap">
                            ${(item.quantity * item.price).toLocaleString("es-CO")}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Coupon */}
                    <div className="border-t border-border pt-4 mb-4">
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
                        <Ticket className="h-4 w-4 text-primary" />
                        Cupón de descuento
                      </p>
                      {appliedCoupon ? (
                        <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2">
                          <div>
                            <span className="font-mono font-semibold text-primary text-sm">{appliedCoupon.code}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              -
                              {appliedCoupon.discount_type === "percentage"
                                ? `${appliedCoupon.discount_value}%`
                                : `$${appliedCoupon.discount_value.toLocaleString("es-CO")}`}
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
                              setCouponError("");
                            }}
                            placeholder="CÓDIGO"
                            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-mono uppercase focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                          <button
                            onClick={applyCoupon}
                            disabled={couponLoading}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                          </button>
                        </div>
                      )}
                      {couponError && <p className="text-xs text-destructive mt-1">{couponError}</p>}
                    </div>

                    <div className="border-t border-border pt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="text-foreground">${totalPrice.toLocaleString("es-CO")}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Descuento</span>
                          <span className="text-green-600 font-medium">-${discountAmount.toLocaleString("es-CO")}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Envío</span>
                        <span className="text-foreground">
                          {shippingCost === 0 ? (
                            <span className="text-green-600 font-medium">Gratis</span>
                          ) : (
                            `$${shippingCost.toLocaleString("es-CO")}`
                          )}
                        </span>
                      </div>
                      {shippingCost > 0 && (
                        <p className="text-xs text-muted-foreground">Envío gratis en compras mayores a $100.000</p>
                      )}
                      <div className="flex justify-between pt-2 border-t border-border">
                        <span className="font-semibold text-foreground">Total</span>
                        <span className="font-display text-xl font-bold text-primary">
                          ${finalTotal.toLocaleString("es-CO")}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handlePayment}
                      disabled={isProcessing || epaycoLoading || !isLoaded}
                      className="w-full mt-6 btn-kpu flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing || epaycoLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-5 w-5" />
                          Pagar ${finalTotal.toLocaleString("es-CO")}
                        </>
                      )}
                    </button>

                  </div>
                </div>
              )}
            </div>

            {/* Order Summary sidebar (visible on shipping/account steps) */}
            {step !== "review" && (
              <div className="lg:col-span-1">
                <div className="bg-card rounded-2xl p-5 sm:p-6 shadow-lg sticky top-24">
                  <div className="flex items-center gap-3 mb-4">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    <h2 className="font-display text-lg font-bold text-card-foreground">Tu Pedido</h2>
                  </div>
                  <div className="space-y-3 mb-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-lg" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.weight} • {item.grind}
                          </p>
                          <p className="text-xs text-foreground">
                            {item.quantity} x ${item.price.toLocaleString("es-CO")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${totalPrice.toLocaleString("es-CO")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Envío</span>
                      <span>
                        {shippingCost === 0 ? (
                          <span className="text-green-600 font-medium">Gratis</span>
                        ) : (
                          `$${shippingCost.toLocaleString("es-CO")}`
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border font-semibold">
                      <span>Total</span>
                      <span className="font-display text-lg text-primary">${finalTotal.toLocaleString("es-CO")}</span>
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
            ? "bg-green-500 text-white"
            : active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : number}
      </div>
      <span className={`text-sm font-medium hidden sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}>
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
