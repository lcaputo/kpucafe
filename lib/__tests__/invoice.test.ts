import { describe, it, expect } from 'vitest';
import { buildInvoiceHtml, type InvoiceOrder } from '@/lib/invoice';

const baseOrder: InvoiceOrder = {
  id: 'abc12345-0000-0000-0000-000000000000',
  status: 'paid',
  total: 52000,
  discountAmount: 5000,
  shippingName: 'Juan Perez',
  shippingPhone: '3001234567',
  shippingAddress: 'Calle 10 # 20-30',
  shippingCity: 'Bogota',
  shippingDepartment: 'Bogota D.C.',
  paymentReference: 'TXN-999',
  createdAt: '2026-04-21T12:00:00.000Z',
  items: [
    { productName: 'Cafe Especial', variantInfo: '250g - Molido', quantity: 2, unitPrice: 45000 },
  ],
  coupon: { code: 'PROMO10', discountType: 'percentage', discountValue: 10 },
};

describe('buildInvoiceHtml', () => {
  it('includes the order number', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('ABC12345');
  });

  it('includes the customer name', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('Juan Perez');
  });

  it('includes the product name', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('Cafe Especial');
  });

  it('includes variant info', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('250g - Molido');
  });

  it('includes the coupon code', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('PROMO10');
  });

  it('includes the payment reference', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('TXN-999');
  });

  it('includes the shipping address', () => {
    const html = buildInvoiceHtml(baseOrder);
    expect(html).toContain('Calle 10 # 20-30');
    expect(html).toContain('Bogota D.C.');
  });

  it('renders correctly without coupon', () => {
    const order = { ...baseOrder, coupon: null, discountAmount: 0 };
    const html = buildInvoiceHtml(order);
    expect(html).toContain('Cafe Especial');
    expect(html).not.toContain('PROMO10');
  });

  it('shows "Gratis" for zero shipping cost', () => {
    // total = subtotal (90000) - discount (0) + shipping (0) = 90000
    const order: InvoiceOrder = {
      ...baseOrder,
      total: 90000,
      discountAmount: 0,
      coupon: null,
      items: [{ productName: 'Cafe', variantInfo: '', quantity: 1, unitPrice: 90000 }],
    };
    const html = buildInvoiceHtml(order);
    expect(html).toContain('Gratis');
  });
});
