// app/pedido/[id]/page.tsx
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Header from '@/components/header';
import Footer from '@/components/footer';
import OrderStatusPoller from './order-status-poller';
import { MapPin, Package, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Estado del Pedido | KPU Cafe',
  robots: { index: false },
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/auth');

  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, userId: session.id },
    include: {
      items: true,
      coupon: { select: { code: true, discountType: true, discountValue: true } },
    },
  });

  if (!order) notFound();

  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const shippingCost = order.total - subtotal + order.discountAmount;

  const invoiceOrder = {
    id: order.id,
    status: order.status as string,
    total: order.total,
    discountAmount: order.discountAmount,
    shippingName: order.shippingName,
    shippingPhone: order.shippingPhone,
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    shippingDepartment: order.shippingDepartment,
    paymentReference: order.paymentReference,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      productName: item.productName,
      variantInfo: item.variantInfo,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    coupon: order.coupon ?? null,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <Link
            href="/mis-pedidos"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Mis pedidos
          </Link>
          <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-lg">

            {/* Header */}
            <div className="text-center mb-8">
              <p className="text-sm text-muted-foreground mb-1">
                Pedido #{order.id.slice(0, 8).toUpperCase()}
              </p>
              <h1 className="font-display text-2xl font-bold text-card-foreground mb-6">
                Detalle del Pedido
              </h1>
              <OrderStatusPoller
                orderId={order.id}
                initialStatus={order.status as 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'}
                order={invoiceOrder}
                muData={{
                  deliveryMethod: order.deliveryMethod,
                  muStatus: order.muStatus,
                  muDriverName: order.muDriverName,
                  muDriverPhone: order.muDriverPhone,
                  muDriverPlate: order.muDriverPlate,
                  muTrackingUrl: order.muTrackingUrl,
                  muEta: order.muEta,
                  scheduledDate: order.scheduledDate?.toISOString() ?? null,
                  enviaCarrier: order.enviaCarrier ?? undefined,
                  enviaDeliveryEstimate: order.enviaDeliveryEstimate ?? undefined,
                  enviaLabelUrl: order.enviaLabelUrl ?? undefined,
                }}
              />
            </div>

            {/* Products */}
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Productos
              </h2>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start bg-muted/50 rounded-xl p-3"
                  >
                    <div>
                      <p className="font-medium text-foreground text-sm">{item.productName}</p>
                      {item.variantInfo && (
                        <p className="text-xs text-muted-foreground">{item.variantInfo}</p>
                      )}
                      <p className="text-xs text-muted-foreground">x {item.quantity}</p>
                    </div>
                    <p className="text-foreground text-sm whitespace-nowrap">
                      ${(item.unitPrice * item.quantity).toLocaleString('es-CO')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toLocaleString('es-CO')}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Descuento{order.coupon ? ` (${order.coupon.code})` : ''}
                  </span>
                  <span className="text-green-600">
                    -${order.discountAmount.toLocaleString('es-CO')}
                  </span>
                </div>
              )}
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
                <span className="text-foreground">Total</span>
                <span className="font-display text-lg text-primary">
                  ${order.total.toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            {/* Shipping address */}
            <div className="bg-muted/50 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Direccion de envio
              </h2>
              <p className="font-medium text-foreground text-sm">{order.shippingName}</p>
              <p className="text-sm text-muted-foreground">{order.shippingPhone}</p>
              <p className="text-sm text-foreground">{order.shippingAddress}</p>
              <p className="text-sm text-foreground">
                {order.shippingCity}
                {order.shippingDepartment ? `, ${order.shippingDepartment}` : ''}
              </p>
            </div>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
