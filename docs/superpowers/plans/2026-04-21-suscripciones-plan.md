# Módulo de Suscripciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full subscription system — wizard for subscribing, user pages for managing subscriptions and payment methods, automated daily billing via cron, and a complete admin panel with stats and billing history.

**Architecture:** Subscription wizard at `/suscribirse?plan=xxx` (3-step: coffee → address → payment). Auto-billing runs via `POST /api/subscriptions/process-billing` triggered by a daily cron on the VPS. Admin panel has stats (MRR, churn) and per-subscription billing history.

**Tech Stack:** Next.js 16 App Router, Prisma 6, PostgreSQL, `lib/epayco.ts`, `lib/billing.ts`, `components/CardForm.tsx`, `hooks/useCardPayment.ts`

**Requires:** `2026-04-21-pagos-tokenizados-plan.md` completed first.

---

### Task 1: Subscription API rewrite + billing history endpoint

**Files:**
- Modify: `app/api/subscriptions/route.ts` (POST rewrite)
- Modify: `app/api/subscriptions/[id]/route.ts` (keep PATCH, add GET)
- Create: `app/api/subscriptions/[id]/billing/route.ts`
- Create: `app/api/subscriptions/[id]/plan/route.ts`

- [ ] **Step 1: Rewrite POST /api/subscriptions**

Replace all content of `app/api/subscriptions/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { computeNextBillingDate } from '@/lib/billing';

export async function GET() {
  try {
    const session = await requireAuth();
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: session.id },
      include: {
        product: { select: { name: true, imageUrl: true } },
        variant: { select: { weight: true, grind: true } },
        plan: { select: { name: true, frequencyLabel: true } },
        paymentMethod: { select: { franchise: true, mask: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(subscriptions);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const {
      planId, productId, variantId,
      paymentMethodId,
      shippingAddress, shippingCity,
      shippingDepartment,
    } = await req.json();

    if (!planId || !productId || !paymentMethodId || !shippingAddress || !shippingCity) {
      return NextResponse.json({ message: 'Datos incompletos' }, { status: 400 });
    }

    // Verify payment method belongs to user
    const method = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId: session.id },
    });
    if (!method) return NextResponse.json({ message: 'Método de pago no válido' }, { status: 400 });

    // Get plan
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) return NextResponse.json({ message: 'Plan no disponible' }, { status: 400 });

    // Get product + variant price
    const variant = variantId
      ? await prisma.productVariant.findUnique({ where: { id: variantId } })
      : null;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ message: 'Producto no encontrado' }, { status: 404 });

    const price = plan.price;
    const frequency = plan.frequency as 'weekly' | 'biweekly' | 'monthly';
    const today = new Date();
    const nextDeliveryDate = computeNextBillingDate(today, frequency);

    const subscription = await prisma.subscription.create({
      data: {
        userId: session.id,
        productId,
        variantId: variantId || null,
        planId,
        planName: plan.name,
        paymentMethodId,
        frequency,
        status: 'active',
        price,
        shippingAddress,
        shippingCity,
        nextDeliveryDate,
      },
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add GET to /api/subscriptions/[id] route**

Replace all content of `app/api/subscriptions/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const sub = await prisma.subscription.findFirst({
      where: { id, userId: session.id },
      include: {
        product: { select: { name: true, imageUrl: true } },
        variant: { select: { weight: true, grind: true } },
        plan: { select: { name: true, frequencyLabel: true } },
        paymentMethod: { select: { franchise: true, mask: true } },
      },
    });
    if (!sub) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });
    return NextResponse.json(sub);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { status } = await req.json();

    const allowed = ['active', 'paused', 'cancelled'];
    if (!allowed.includes(status)) {
      return NextResponse.json({ message: 'Estado no válido' }, { status: 400 });
    }

    const result = await prisma.subscription.updateMany({
      where: { id, userId: session.id },
      data: { status },
    });
    if (result.count === 0) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create billing history endpoint**

Create `app/api/subscriptions/[id]/billing/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Verify ownership
    const sub = await prisma.subscription.findFirst({
      where: { id, userId: session.id },
    });
    if (!sub) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });

    const records = await prisma.billingRecord.findMany({
      where: { subscriptionId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json(records);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create plan change endpoint**

Create `app/api/subscriptions/[id]/plan/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { planId } = await req.json();

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) return NextResponse.json({ message: 'Plan no disponible' }, { status: 400 });

    const result = await prisma.subscription.updateMany({
      where: { id, userId: session.id },
      data: {
        planId,
        planName: plan.name,
        price: plan.price,
        frequency: plan.frequency as any,
      },
    });
    if (result.count === 0) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/subscriptions/
git commit -m "feat: rewrite subscription endpoints with plan/payment method support"
```

---

### Task 2: POST /api/subscriptions/process-billing (cron endpoint)

**Files:**
- Create: `app/api/subscriptions/process-billing/route.ts`

- [ ] **Step 1: Add BILLING_SECRET to .env.local**

```bash
echo 'BILLING_SECRET=dev-secret-change-in-production' >> .env.local
```

- [ ] **Step 2: Create the endpoint**

Create `app/api/subscriptions/process-billing/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chargeCard, EpaycoError } from '@/lib/epayco';
import { computeNextBillingDate } from '@/lib/billing';

export async function POST(req: Request) {
  // Verify secret
  const auth = req.headers.get('authorization') || '';
  const secret = process.env.BILLING_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999); // include everything up to end of today

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      nextDeliveryDate: { lte: today },
      paymentMethodId: { not: null },
    },
    include: {
      paymentMethod: true,
      product: { select: { name: true } },
      variant: { select: { weight: true, grind: true } },
      user: { include: { profile: true } },
    },
  });

  let approved = 0, failed = 0, paused = 0;

  for (const sub of subscriptions) {
    if (!sub.paymentMethod) continue;

    // Create order for this billing cycle
    const order = await prisma.order.create({
      data: {
        userId: sub.userId,
        status: 'pending',
        total: sub.price,
        shippingName: sub.user.profile?.fullName || 'Cliente',
        shippingPhone: sub.user.profile?.phone || '',
        shippingAddress: sub.shippingAddress,
        shippingCity: sub.shippingCity,
        items: {
          create: [{
            productName: sub.product?.name || sub.planName || 'Café KPU',
            variantInfo: sub.variant ? `${sub.variant.weight} - ${sub.variant.grind}` : '',
            quantity: 1,
            unitPrice: sub.price,
          }],
        },
      },
    });

    // Get current retry count for this sub
    const lastFailed = await prisma.billingRecord.findFirst({
      where: { subscriptionId: sub.id, status: { in: ['rejected', 'failed'] } },
      orderBy: { createdAt: 'desc' },
    });
    const retryCount = lastFailed ? lastFailed.retryCount + 1 : 0;

    let chargeStatus: 'approved' | 'rejected' | 'failed' = 'failed';
    let epaycoRef: string | null = null;
    let errorMessage: string | null = null;

    try {
      const result = await chargeCard({
        tokenId: sub.paymentMethod.tokenId,
        customerId: sub.paymentMethod.customerId,
        amount: sub.price,
        description: `KPU Cafe - ${sub.planName || 'Suscripción'}`,
        invoiceNumber: order.id,
        buyerName: sub.user.profile?.fullName || 'Cliente',
        buyerEmail: sub.user.email,
        buyerPhone: sub.user.profile?.phone || undefined,
        buyerAddress: sub.shippingAddress,
        buyerCity: sub.shippingCity,
      });

      chargeStatus = result.status === 'approved' ? 'approved' : 'rejected';
      epaycoRef = result.epaycoRef;

      if (result.status === 'approved') {
        // Advance billing date
        const nextDate = computeNextBillingDate(
          sub.nextDeliveryDate,
          sub.frequency as 'weekly' | 'biweekly' | 'monthly',
        );
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { nextDeliveryDate: nextDate },
        });
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'paid', paymentReference: epaycoRef },
        });
        approved++;
      } else {
        await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
        failed++;
        // Pause after 3 consecutive failures
        if (retryCount >= 2) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'paused' },
          });
          paused++;
        }
      }
    } catch (err: any) {
      chargeStatus = 'failed';
      errorMessage = err instanceof EpaycoError ? err.message : String(err.message);
      await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
      failed++;
      if (retryCount >= 2) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'paused' },
        });
        paused++;
      }
    }

    await prisma.billingRecord.create({
      data: {
        subscriptionId: sub.id,
        orderId: order.id,
        paymentMethodId: sub.paymentMethodId!,
        amount: sub.price,
        status: chargeStatus,
        epaycoRef,
        errorMessage,
        retryCount,
      },
    });
  }

  return NextResponse.json({
    processed: subscriptions.length,
    approved,
    failed,
    paused,
  });
}
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | grep -E "process-billing" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add app/api/subscriptions/process-billing/ .env.local
git commit -m "feat: add process-billing cron endpoint"
```

---

### Task 3: Admin subscription API endpoints

**Files:**
- Create: `app/api/admin/subscriptions/stats/route.ts`
- Create: `app/api/admin/subscriptions/[id]/billing/route.ts`
- Create: `app/api/admin/subscriptions/[id]/charge/route.ts`

- [ ] **Step 1: Create stats endpoint**

Create `app/api/admin/subscriptions/stats/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();

    const [active, paused, cancelled, recentCancellations, totalLast30Days] = await Promise.all([
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.subscription.count({ where: { status: 'paused' } }),
      prisma.subscription.count({ where: { status: 'cancelled' } }),
      prisma.subscription.count({
        where: {
          status: 'cancelled',
          updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.subscription.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // MRR = sum of prices of all active subscriptions
    const mrrResult = await prisma.subscription.aggregate({
      where: { status: 'active' },
      _sum: { price: true },
    });

    const churnRate = active > 0 ? Math.round((recentCancellations / (active + recentCancellations)) * 100) : 0;

    return NextResponse.json({
      active,
      paused,
      cancelled,
      mrr: mrrResult._sum.price || 0,
      churnRate,
      totalLast30Days,
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create admin billing history endpoint**

Create `app/api/admin/subscriptions/[id]/billing/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const records = await prisma.billingRecord.findMany({
      where: { subscriptionId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(records);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create admin retry charge endpoint**

Create `app/api/admin/subscriptions/[id]/charge/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { chargeCard, EpaycoError } from '@/lib/epayco';
import { computeNextBillingDate } from '@/lib/billing';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        paymentMethod: true,
        product: { select: { name: true } },
        variant: { select: { weight: true, grind: true } },
        user: { include: { profile: true } },
      },
    });
    if (!sub) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });
    if (!sub.paymentMethod) return NextResponse.json({ message: 'Sin método de pago' }, { status: 400 });

    const order = await prisma.order.create({
      data: {
        userId: sub.userId,
        status: 'pending',
        total: sub.price,
        shippingName: sub.user.profile?.fullName || 'Cliente',
        shippingPhone: sub.user.profile?.phone || '',
        shippingAddress: sub.shippingAddress,
        shippingCity: sub.shippingCity,
        items: {
          create: [{
            productName: sub.product?.name || sub.planName || 'Café KPU',
            variantInfo: sub.variant ? `${sub.variant.weight} - ${sub.variant.grind}` : '',
            quantity: 1,
            unitPrice: sub.price,
          }],
        },
      },
    });

    const result = await chargeCard({
      tokenId: sub.paymentMethod.tokenId,
      customerId: sub.paymentMethod.customerId,
      amount: sub.price,
      description: `KPU Cafe - ${sub.planName} (reintento admin)`,
      invoiceNumber: order.id,
      buyerName: sub.user.profile?.fullName || 'Cliente',
      buyerEmail: sub.user.email,
    });

    await prisma.billingRecord.create({
      data: {
        subscriptionId: sub.id,
        orderId: order.id,
        paymentMethodId: sub.paymentMethodId!,
        amount: sub.price,
        status: result.status === 'approved' ? 'approved' : 'rejected',
        epaycoRef: result.epaycoRef,
        retryCount: 0,
      },
    });

    if (result.status === 'approved') {
      const nextDate = computeNextBillingDate(
        sub.nextDeliveryDate,
        sub.frequency as 'weekly' | 'biweekly' | 'monthly',
      );
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'active', nextDeliveryDate: nextDate },
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'paid', paymentReference: result.epaycoRef },
      });
    } else {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
    }

    return NextResponse.json({ status: result.status, epaycoRef: result.epaycoRef });
  } catch (err: any) {
    if (err instanceof EpaycoError) return NextResponse.json({ message: err.message }, { status: 400 });
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/subscriptions/stats/ app/api/admin/subscriptions/[id]/billing/ app/api/admin/subscriptions/[id]/charge/
git commit -m "feat: add admin subscription stats, billing history, and retry charge endpoints"
```

---

### Task 4: app/suscribirse/page.tsx — Subscription wizard

**Files:**
- Create: `app/suscribirse/page.tsx`

- [ ] **Step 1: Create the wizard page**

Create `app/suscribirse/page.tsx`:

```tsx
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
}

function SubscribeWizardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { savedMethods, loadingMethods, saveCard, chargeSaved } = useCardPayment();

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

  // Load plan and products
  useEffect(() => {
    if (!planId || !user) return;
    Promise.all([
      fetch(`/api/subscription-plans/${planId}`).then(r => r.json()),
      fetch('/api/products?active=true').then(r => r.json()),
      fetch('/api/shipping-addresses').then(r => r.json()),
    ]).then(([planData, productsData, addressesData]) => {
      setPlan(planData);
      setProducts(productsData || []);
      const addrs: SavedAddress[] = (addressesData || []).map((a: any) => ({
        id: a.id, label: a.label,
        fullName: a.fullName, phone: a.phone,
        address: a.address, city: a.city, department: a.department,
      }));
      setSavedAddresses(addrs);
      if (addrs.length === 0) setShowNewAddress(true);
      else {
        const def = addrs.find(a => a.isDefault) || addrs[0];
        setSelectedAddressId(def.id);
      }
    }).catch(() => toast({ title: 'Error', description: 'No se pudo cargar la información', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [planId, user, toast]);

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

  const getShippingAddress = () => {
    if (selectedAddressId) {
      const addr = savedAddresses.find(a => a.id === selectedAddressId);
      return addr ? { address: addr.address, city: addr.city } : null;
    }
    if (showNewAddress) {
      return { address: addressForm.address, city: addressForm.city };
    }
    return null;
  };

  const handleActivate = async (methodId: string) => {
    if (!plan || !selectedProductId || !planId) return;
    const shipping = getShippingAddress();
    if (!shipping) {
      toast({ title: 'Dirección requerida', variant: 'destructive' });
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

      // Charge first cycle
      const charge = await chargeSaved(methodId, plan.price, sub.id);

      if (charge.status === 'approved') {
        toast({ title: '¡Suscripción activada!', description: 'Tu primer envío está en camino.' });
        router.push('/mis-suscripciones');
      } else if (charge.status === 'rejected') {
        throw new Error(charge.message || 'Pago rechazado');
      } else {
        toast({ title: 'Pago pendiente', description: 'Te notificaremos cuando se confirme.' });
        router.push('/mis-suscripciones');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Note: charge with saved card from subscription uses payment-methods/[id]/charge
  // but for subscriptions we need to link the subscriptionId not orderId.
  // The charge endpoint needs updating to accept subscriptionId.
  // For now, we create the subscription first then charge an amount.
  // The billing record is created by the cron for subsequent charges.
  // First charge: use payment-methods/[id]/charge with amount+orderId approach:
  // We create a one-time order for the first charge, then the subscription takes over.

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

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Plan no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-5 w-5" /> Volver
          </button>

          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Activar suscripción</h1>
          <p className="text-muted-foreground mb-6">{plan.name} · {plan.frequencyLabel} · ${plan.price.toLocaleString('es-CO')} COP</p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {([1, 2, 3] as const).map((s, i) => (
              <>
                <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                {i < 2 && <div className="h-px flex-1 bg-border" />}
              </>
            ))}
          </div>

          {/* Step 1: Choose coffee */}
          {step === 1 && (
            <div className="bg-card rounded-2xl p-6 shadow-lg">
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
                        <div className="relative w-14 h-14 flex-shrink-0">
                          <Image src={p.imageUrl} alt={p.name} fill className="object-cover rounded-lg" sizes="56px" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{p.name}</p>
                        {selectedProductId === p.id && p.variants.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {p.variants.map(v => (
                              <button
                                key={v.id}
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
            <div className="bg-card rounded-2xl p-6 shadow-lg">
              <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> Dirección de entrega
              </h2>
              {savedAddresses.length > 0 && !showNewAddress && (
                <div className="space-y-2 mb-4">
                  {savedAddresses.map(addr => (
                    <div
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${selectedAddressId === addr.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
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
                    onClick={() => { setShowNewAddress(true); setSelectedAddressId(null); }}
                    className="flex items-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-sm text-muted-foreground"
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
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  ))}
                  {savedAddresses.length > 0 && (
                    <button onClick={() => { setShowNewAddress(false); setSelectedAddressId(savedAddresses[0].id); }} className="text-sm text-primary hover:underline">
                      Usar dirección guardada
                    </button>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors">
                  Atrás
                </button>
                <button
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
            <div className="bg-card rounded-2xl p-6 shadow-lg">
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
                        <p className="text-sm font-medium">{m.franchise} •••• {m.mask.slice(-4)}</p>
                        <p className="text-xs text-muted-foreground">Vence {m.expMonth}/{m.expYear}</p>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => { setShowCardForm(true); setSelectedMethodId(null); }} className="flex items-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-sm text-muted-foreground">
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
                  <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-border text-foreground hover:bg-muted">
                    Atrás
                  </button>
                  <button
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SubscribeWizardInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Add subscription-plans endpoint (needed by wizard)**

Create `app/api/subscription-plans/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!plan || !plan.isActive) return NextResponse.json({ message: 'Plan no disponible' }, { status: 404 });
  return NextResponse.json(plan);
}
```

- [ ] **Step 3: Update charge endpoint to accept subscriptionId**

The first charge for a subscription needs a different approach. In `app/api/payment-methods/[id]/charge/route.ts`, add support for `subscriptionId` alongside `orderId`:

In the body parsing section, add:
```typescript
const { amount, orderId, subscriptionId } = await req.json();
if (!amount || (!orderId && !subscriptionId)) {
  return NextResponse.json({ message: 'amount y orderId o subscriptionId requeridos' }, { status: 400 });
}
```

When `subscriptionId` is provided instead of `orderId`, create a one-time order for the first billing cycle:
```typescript
let targetOrderId = orderId;
if (!orderId && subscriptionId) {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { product: true, variant: true },
  });
  if (!sub) return NextResponse.json({ message: 'Suscripción no encontrada' }, { status: 404 });
  const newOrder = await prisma.order.create({
    data: {
      userId: session.id, status: 'pending', total: amount,
      shippingName: 'Cliente KPU', shippingPhone: '',
      shippingAddress: sub.shippingAddress,
      shippingCity: sub.shippingCity,
      items: {
        create: [{
          productName: sub.product?.name || sub.planName || 'Café KPU',
          variantInfo: sub.variant ? `${sub.variant.weight} - ${sub.variant.grind}` : '',
          quantity: 1, unitPrice: amount,
        }],
      },
    },
  });
  targetOrderId = newOrder.id;
}
```

Then use `targetOrderId` instead of `orderId` in the rest of the function. Also save a `BillingRecord` when the charge is for a subscription:

After the order status update, if `subscriptionId` is provided:
```typescript
if (subscriptionId && result.status === 'approved') {
  await prisma.billingRecord.create({
    data: {
      subscriptionId,
      orderId: targetOrderId,
      paymentMethodId: id,
      amount,
      status: 'approved',
      epaycoRef: result.epaycoRef,
      retryCount: 0,
    },
  });
}
```

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | grep -E "error TS|Error" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add app/suscribirse/ app/api/subscription-plans/ app/api/payment-methods/[id]/charge/route.ts
git commit -m "feat: add subscription wizard and first-charge support"
```

---

### Task 5: app/mis-suscripciones rewrite + app/mis-metodos-de-pago

**Files:**
- Modify: `app/mis-suscripciones/page.tsx`
- Create: `app/mis-metodos-de-pago/page.tsx`

- [ ] **Step 1: Rewrite mis-suscripciones**

Replace all content of `app/mis-suscripciones/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/header';
import Footer from '@/components/footer';
import {
  Coffee, Calendar, CreditCard, Pause, Play, XCircle,
  Loader2, ChevronDown, ChevronUp, Plus, RefreshCw,
} from 'lucide-react';

interface BillingRecord {
  id: string;
  amount: number;
  status: string;
  epaycoRef: string | null;
  createdAt: string;
}

interface Subscription {
  id: string;
  planName: string;
  frequency: string;
  status: string;
  nextDeliveryDate: string;
  price: number;
  shippingCity: string;
  product: { name: string } | null;
  variant: { weight: string; grind: string } | null;
  plan: { frequencyLabel: string } | null;
  paymentMethod: { franchise: string; mask: string } | null;
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

const BILLING_STATUS_COLORS: Record<string, string> = {
  approved: 'text-green-600',
  rejected: 'text-red-500',
  pending: 'text-yellow-600',
  failed: 'text-red-500',
};

export default function MisSuscripciones() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [billingRecords, setBillingRecords] = useState<Record<string, BillingRecord[]>>({});
  const [loadingBilling, setLoadingBilling] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) fetchSubscriptions();
  }, [user]);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/subscriptions');
      setSubscriptions((await res.json()) || []);
    } catch {
      toast({ title: 'Error al cargar suscripciones', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!billingRecords[id]) {
      setLoadingBilling(id);
      try {
        const res = await fetch(`/api/subscriptions/${id}/billing`);
        setBillingRecords(r => ({ ...r, [id]: await res.json() }));
      } catch {
        setBillingRecords(r => ({ ...r, [id]: [] }));
      } finally {
        setLoadingBilling(null);
      }
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const label = status === 'active' ? 'reactivada' : status === 'paused' ? 'pausada' : 'cancelada';
      toast({ title: `Suscripción ${label}` });
      fetchSubscriptions();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl font-bold text-foreground">Mis Suscripciones</h1>
            <Link href="/suscribirse" className="btn-kpu flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Nueva
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl">
              <RefreshCw className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="font-display text-xl font-semibold mb-2">No tienes suscripciones</h2>
              <p className="text-muted-foreground mb-6">¡Suscríbete y recibe café fresco automáticamente!</p>
              <Link href="/#suscripciones" className="btn-kpu inline-block">Ver Planes</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map(sub => (
                <div key={sub.id} className="bg-card rounded-2xl shadow-soft overflow-hidden">
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2 ${STATUS_COLORS[sub.status] || STATUS_COLORS.cancelled}`}>
                          {sub.status === 'active' ? 'Activa' : sub.status === 'paused' ? 'Pausada' : 'Cancelada'}
                        </span>
                        <h3 className="font-display text-lg font-bold text-foreground">
                          {sub.product?.name || sub.planName}
                        </h3>
                        {sub.variant && (
                          <p className="text-sm text-muted-foreground">{sub.variant.weight} · {sub.variant.grind}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-display text-2xl font-bold text-primary">${sub.price.toLocaleString('es-CO')}</p>
                        <p className="text-xs text-muted-foreground">{FREQ_LABELS[sub.frequency] || sub.frequency}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Próximo: <span className="text-foreground font-medium">
                          {new Date(sub.nextDeliveryDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                        </span></span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Coffee className="h-4 w-4" />
                        <span>{sub.shippingCity}</span>
                      </div>
                      {sub.paymentMethod && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CreditCard className="h-4 w-4" />
                          <span>{sub.paymentMethod.franchise} •••• {sub.paymentMethod.mask.slice(-4)}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      {sub.status === 'active' && (
                        <button onClick={() => updateStatus(sub.id, 'paused')} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground">
                          <Pause className="h-3.5 w-3.5" /> Pausar
                        </button>
                      )}
                      {sub.status === 'paused' && (
                        <button onClick={() => updateStatus(sub.id, 'active')} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                          <Play className="h-3.5 w-3.5" /> Reactivar
                        </button>
                      )}
                      {sub.status !== 'cancelled' && (
                        <button onClick={() => { if (confirm('¿Cancelar esta suscripción?')) updateStatus(sub.id, 'cancelled'); }} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5" /> Cancelar
                        </button>
                      )}
                      <button onClick={() => toggleExpanded(sub.id)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground ml-auto">
                        {expandedId === sub.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        Historial
                      </button>
                    </div>
                  </div>

                  {/* Billing history accordion */}
                  {expandedId === sub.id && (
                    <div className="border-t border-border px-5 sm:px-6 py-4 bg-muted/30">
                      <p className="text-sm font-semibold text-foreground mb-3">Historial de cobros</p>
                      {loadingBilling === sub.id ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>
                      ) : (billingRecords[sub.id] || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin cobros registrados.</p>
                      ) : (
                        <div className="space-y-2">
                          {(billingRecords[sub.id] || []).map(r => (
                            <div key={r.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-3">
                                <span className={`font-medium capitalize ${BILLING_STATUS_COLORS[r.status]}`}>
                                  {r.status === 'approved' ? 'Aprobado' : r.status === 'rejected' ? 'Rechazado' : r.status === 'pending' ? 'Pendiente' : 'Fallido'}
                                </span>
                                <span className="text-muted-foreground">${r.amount.toLocaleString('es-CO')}</span>
                              </div>
                              <div className="text-right">
                                {r.epaycoRef && <p className="text-xs text-muted-foreground font-mono">{r.epaycoRef}</p>}
                                <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('es-CO')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Create mis-metodos-de-pago page**

Create `app/mis-metodos-de-pago/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { useCardPayment } from '@/hooks/useCardPayment';
import CardForm, { CardTokenResult } from '@/components/CardForm';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { CreditCard, Trash2, Star, Plus, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MisMetodosDePago() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { savedMethods, loadingMethods, fetchMethods, saveCard, deleteMethod, setDefault } = useCardPayment();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [authLoading, user, router]);

  const handleNewCard = async (token: CardTokenResult) => {
    setSaving(true);
    try {
      await saveCard(token);
      setShowForm(false);
      toast({ title: 'Tarjeta guardada correctamente' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta tarjeta?')) return;
    try {
      await deleteMethod(id);
      toast({ title: 'Tarjeta eliminada' });
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefault(id);
      toast({ title: 'Tarjeta predeterminada actualizada' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-5 w-5" /> Volver
          </button>
          <h1 className="font-display text-2xl font-bold text-foreground mb-6">Métodos de Pago</h1>

          {loadingMethods ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3 mb-6">
              {savedMethods.map(m => (
                <div key={m.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 bg-card ${m.isDefault ? 'border-primary' : 'border-border'}`}>
                  <CreditCard className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground capitalize">{m.franchise} •••• {m.mask.slice(-4)}</p>
                      {m.isDefault && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Predeterminada</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">Vence {m.expMonth}/{m.expYear}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!m.isDefault && (
                      <button onClick={() => handleSetDefault(m.id)} title="Establecer como predeterminada" className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(m.id)} title="Eliminar" className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {savedMethods.length === 0 && !showForm && (
                <p className="text-center text-muted-foreground py-8">No tienes tarjetas guardadas.</p>
              )}
            </div>
          )}

          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 w-full p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-5 w-5" /> Agregar tarjeta
            </button>
          ) : (
            <div className="bg-card rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">Nueva tarjeta</h2>
                <button onClick={() => setShowForm(false)} className="text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              </div>
              <CardForm onSuccess={handleNewCard} submitLabel="Guardar tarjeta" loading={saving} />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/mis-suscripciones/page.tsx app/mis-metodos-de-pago/page.tsx
git commit -m "feat: rewrite mis-suscripciones and add mis-metodos-de-pago page"
```

---

### Task 6: Admin subscriptions rewrite + detail page

**Files:**
- Modify: `app/admin/suscripciones/page.tsx`
- Create: `app/admin/suscripciones/[id]/page.tsx`
- Modify: `app/admin/layout.tsx` (add nav link)

- [ ] **Step 1: Rewrite admin subscriptions page**

Replace all content of `app/admin/suscripciones/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, RefreshCw, Pause, Play, XCircle,
  RotateCcw, TrendingUp, Users, PauseCircle, AlertCircle,
} from 'lucide-react';

interface Stats {
  active: number;
  paused: number;
  cancelled: number;
  mrr: number;
  churnRate: number;
}

interface Subscription {
  id: string;
  planName: string;
  frequency: string;
  status: string;
  price: number;
  nextDeliveryDate: string;
  userId: string;
  product: { name: string } | null;
  variant: { weight: string; grind: string } | null;
  plan: { name: string; frequencyLabel: string } | null;
  paymentMethod: { franchise: string; mask: string } | null;
  user: { email: string; profile: { fullName: string | null } | null } | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function AdminSubscriptionsPage() {
  const { toast } = useToast();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subsRes, statsRes] = await Promise.all([
        fetch('/api/admin/subscriptions'),
        fetch('/api/admin/subscriptions/stats'),
      ]);
      setSubs(await subsRes.json());
      setStats(await statsRes.json());
    } catch {
      toast({ title: 'Error al cargar datos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      toast({ title: `Suscripción ${status === 'active' ? 'activada' : status === 'paused' ? 'pausada' : 'cancelada'}` });
      fetchData();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const retryCharge = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}/charge`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'approved') toast({ title: 'Cobro aprobado' });
      else toast({ title: `Cobro ${data.status}`, description: data.epaycoRef || '', variant: 'destructive' });
      fetchData();
    } catch {
      toast({ title: 'Error al reintentar cobro', variant: 'destructive' });
    }
  };

  const filtered = filter === 'all' ? subs : subs.filter(s => s.status === filter);

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'MRR', value: `$${stats.mrr.toLocaleString('es-CO')}`, icon: TrendingUp, color: 'text-primary' },
            { label: 'Activas', value: stats.active, icon: Users, color: 'text-green-500' },
            { label: 'Pausadas', value: stats.paused, icon: PauseCircle, color: 'text-yellow-500' },
            { label: 'Churn 30d', value: `${stats.churnRate}%`, icon: AlertCircle, color: 'text-red-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card rounded-xl p-4 shadow-soft flex items-center gap-3">
              <Icon className={`h-8 w-8 ${color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-display text-xl font-bold text-foreground">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2">
          {['all', 'active', 'paused', 'cancelled'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : f === 'paused' ? 'Pausadas' : 'Canceladas'}
            </button>
          ))}
        </div>
        <button onClick={fetchData} className="p-2 text-muted-foreground hover:text-primary transition-colors">
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl">
          <p className="text-muted-foreground">No hay suscripciones.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  {['Cliente', 'Café', 'Plan', 'Precio', 'Estado', 'Próximo cobro', 'Tarjeta', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-sm font-semibold text-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(sub => (
                  <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/suscripciones/${sub.id}`} className="hover:text-primary">
                        <p className="font-medium text-sm">{sub.user?.profile?.fullName || '—'}</p>
                        <p className="text-xs text-muted-foreground">{sub.user?.email}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p>{sub.product?.name || sub.planName || '—'}</p>
                      {sub.variant && <p className="text-xs text-muted-foreground">{sub.variant.weight} · {sub.variant.grind}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm">{sub.plan?.name || sub.planName || '—'}</td>
                    <td className="px-4 py-3 text-sm font-mono">${sub.price.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[sub.status] || STATUS_COLORS.cancelled}`}>
                        {sub.status === 'active' ? 'Activa' : sub.status === 'paused' ? 'Pausada' : 'Cancelada'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(sub.nextDeliveryDate).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {sub.paymentMethod ? `${sub.paymentMethod.franchise} •••• ${sub.paymentMethod.mask.slice(-4)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {sub.status === 'active' && (
                          <button onClick={() => updateStatus(sub.id, 'paused')} title="Pausar" className="p-1.5 rounded text-muted-foreground hover:text-yellow-600 hover:bg-yellow-50 transition-colors">
                            <Pause className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {sub.status === 'paused' && (
                          <>
                            <button onClick={() => updateStatus(sub.id, 'active')} title="Reactivar" className="p-1.5 rounded text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors">
                              <Play className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => retryCharge(sub.id)} title="Reintentar cobro" className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {sub.status !== 'cancelled' && (
                          <button onClick={() => { if (confirm('¿Cancelar?')) updateStatus(sub.id, 'cancelled'); }} title="Cancelar" className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create admin subscription detail page**

Create `app/admin/suscripciones/[id]/page.tsx`:

```tsx
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, RotateCcw, Pause, Play, XCircle } from 'lucide-react';

interface BillingRecord {
  id: string;
  amount: number;
  status: string;
  epaycoRef: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
}

interface SubscriptionDetail {
  id: string;
  planName: string;
  frequency: string;
  status: string;
  price: number;
  nextDeliveryDate: string;
  shippingAddress: string;
  shippingCity: string;
  product: { name: string } | null;
  variant: { weight: string; grind: string } | null;
  plan: { name: string; frequencyLabel: string } | null;
  paymentMethod: { franchise: string; mask: string; expMonth: string; expYear: string } | null;
  user: { email: string; profile: { fullName: string | null; phone: string | null } | null } | null;
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'text-green-600 bg-green-50',
  rejected: 'text-red-500 bg-red-50',
  pending: 'text-yellow-600 bg-yellow-50',
  failed: 'text-red-500 bg-red-50',
};

export default function AdminSubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [billing, setBilling] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, billingRes] = await Promise.all([
        fetch(`/api/admin/subscriptions/${id}`),
        fetch(`/api/admin/subscriptions/${id}/billing`),
      ]);
      setSub(await subRes.json());
      setBilling(await billingRes.json());
    } catch {
      toast({ title: 'Error al cargar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const updateStatus = async (status: string) => {
    try {
      await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      toast({ title: 'Estado actualizado' });
      fetchData();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const retryCharge = async () => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}/charge`, { method: 'POST' });
      const data = await res.json();
      toast({ title: data.status === 'approved' ? 'Cobro aprobado' : `Cobro ${data.status}` });
      fetchData();
    } catch {
      toast({ title: 'Error al cobrar', variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!sub) return <p className="text-muted-foreground">Suscripción no encontrada.</p>;

  return (
    <div className="max-w-3xl">
      <Link href="/admin/suscripciones" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {/* Info */}
        <div className="bg-card rounded-xl p-5 shadow-soft">
          <h2 className="font-semibold text-foreground mb-3">Información</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Cliente</dt><dd>{sub.user?.profile?.fullName || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd className="truncate max-w-[180px]">{sub.user?.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Café</dt><dd>{sub.product?.name || sub.planName}</dd></div>
            {sub.variant && <div className="flex justify-between"><dt className="text-muted-foreground">Variante</dt><dd>{sub.variant.weight} · {sub.variant.grind}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted-foreground">Plan</dt><dd>{sub.plan?.name || sub.planName}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Precio</dt><dd className="font-mono">${sub.price.toLocaleString('es-CO')}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Próximo cobro</dt><dd>{new Date(sub.nextDeliveryDate).toLocaleDateString('es-CO')}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Dirección</dt><dd className="text-right max-w-[180px]">{sub.shippingAddress}, {sub.shippingCity}</dd></div>
            {sub.paymentMethod && (
              <div className="flex justify-between"><dt className="text-muted-foreground">Tarjeta</dt><dd>{sub.paymentMethod.franchise} •••• {sub.paymentMethod.mask.slice(-4)}</dd></div>
            )}
          </dl>
        </div>

        {/* Actions */}
        <div className="bg-card rounded-xl p-5 shadow-soft">
          <h2 className="font-semibold text-foreground mb-3">Acciones</h2>
          <div className="space-y-2">
            {sub.status === 'active' && (
              <button onClick={() => updateStatus('paused')} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-muted text-sm text-foreground transition-colors">
                <Pause className="h-4 w-4" /> Pausar suscripción
              </button>
            )}
            {sub.status === 'paused' && (
              <>
                <button onClick={() => updateStatus('active')} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">
                  <Play className="h-4 w-4" /> Reactivar suscripción
                </button>
                <button onClick={retryCharge} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-primary/10 hover:border-primary/30 text-sm text-foreground transition-colors">
                  <RotateCcw className="h-4 w-4" /> Reintentar cobro
                </button>
              </>
            )}
            {sub.status !== 'cancelled' && (
              <button onClick={() => { if (confirm('¿Cancelar esta suscripción?')) updateStatus('cancelled'); }} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive text-sm text-foreground transition-colors">
                <XCircle className="h-4 w-4" /> Cancelar suscripción
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Billing history */}
      <div className="bg-card rounded-xl shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Historial de cobros</h2>
        </div>
        {billing.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Sin cobros registrados.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {['Fecha', 'Monto', 'Estado', 'Ref ePayco', 'Intentos', 'Error'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {billing.map(r => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3 text-sm font-mono">${r.amount.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || ''}`}>
                      {r.status === 'approved' ? 'Aprobado' : r.status === 'rejected' ? 'Rechazado' : r.status === 'pending' ? 'Pendiente' : 'Fallido'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.epaycoRef || '—'}</td>
                  <td className="px-4 py-3 text-sm text-center">{r.retryCount}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">{r.errorMessage || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add missing admin API route for individual subscription**

Create `app/api/admin/subscriptions/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        product: { select: { name: true } },
        variant: { select: { weight: true, grind: true } },
        plan: { select: { name: true, frequencyLabel: true } },
        paymentMethod: { select: { franchise: true, mask: true, expMonth: true, expYear: true } },
        user: { include: { profile: true } },
      },
    });
    if (!sub) return NextResponse.json({ message: 'No encontrada' }, { status: 404 });
    return NextResponse.json(sub);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { status } = await req.json();
    await prisma.subscription.update({ where: { id }, data: { status } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/suscripciones/ app/api/admin/subscriptions/[id]/route.ts
git commit -m "feat: rewrite admin subscriptions page with stats and detail view"
```

---

### Task 7: subscription-section CTA + final admin subscriptions API GET

**Files:**
- Modify: `components/subscription-section.tsx`
- Modify: `app/api/admin/subscriptions/route.ts` (add user+plan+method includes)

- [ ] **Step 1: Update subscription-section CTAs**

In `components/subscription-section.tsx`, replace the `<button>` with a Next.js `<Link>`:

1. Add import at top: `import Link from 'next/link';`

2. Replace the button (around line 247):
```tsx
// Remove:
<button
  className={`w-full py-3.5 ...`}
  style={...}
>
  Suscribirse
</button>

// Replace with:
<Link
  href={`/suscribirse?plan=${plan.id}`}
  className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 text-center block ${
    plan.isPopular
      ? 'hover:opacity-95 hover:scale-[1.02] active:scale-95'
      : 'hover:scale-[1.02] active:scale-95'
  }`}
  style={
    plan.isPopular
      ? { background: 'hsl(0 0% 100%)', color: 'hsl(14 82% 50%)', fontWeight: 700, boxShadow: '0 4px 16px hsl(0 0% 0% / 0.15)' }
      : { background: 'var(--gradient-warm)', color: 'white', boxShadow: 'var(--shadow-warm)' }
  }
>
  Suscribirse
</Link>
```

- [ ] **Step 2: Update admin subscriptions GET to include relations**

In `app/api/admin/subscriptions/route.ts`, update the `findMany` include:

```typescript
include: {
  product: { select: { name: true } },
  variant: { select: { weight: true, grind: true } },
  plan: { select: { name: true, frequencyLabel: true } },
  paymentMethod: { select: { franchise: true, mask: true } },
  user: { include: { profile: { select: { fullName: true } } } },
},
```

- [ ] **Step 3: Final build**

```bash
npm run build
```

Expected: clean build with no errors.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 5 tests passed.

- [ ] **Step 5: Final commit**

```bash
git add components/subscription-section.tsx app/api/admin/subscriptions/route.ts
git commit -m "feat: wire subscription-section CTAs to wizard, complete subscription module"
```

---

**Both plans complete.** 

Summary of what's been built:
- Tokenized card payments replacing ePayco widget
- Save card option in checkout
- Full subscription wizard (`/suscribirse`)
- User subscription management (`/mis-suscripciones`)
- User payment methods page (`/mis-metodos-de-pago`)
- Daily billing cron endpoint (`/api/subscriptions/process-billing`)
- Admin panel with MRR/churn stats, billing history, retry charges

Configure the VPS cron as documented in `docs/cron-billing.md`.
