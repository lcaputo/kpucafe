// lib/invoice.ts

export interface InvoiceOrder {
  id: string;
  status: string;
  total: number;
  discountAmount: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingDepartment?: string | null;
  paymentReference?: string | null;
  createdAt: string;
  items: Array<{
    productName: string;
    variantInfo: string;
    quantity: number;
    unitPrice: number;
  }>;
  coupon?: { code: string; discountType: string; discountValue: number } | null;
}

export function buildInvoiceHtml(order: InvoiceOrder): string {
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const shippingCost = order.total - subtotal + order.discountAmount;

  const itemRows = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding:8px 4px;border-bottom:1px solid #eee;">
        <strong>${item.productName}</strong>
        ${item.variantInfo ? `<br><small style="color:#666;">${item.variantInfo}</small>` : ''}
      </td>
      <td style="padding:8px 4px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #eee;text-align:right;">$${item.unitPrice.toLocaleString('es-CO')}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #eee;text-align:right;">$${(item.unitPrice * item.quantity).toLocaleString('es-CO')}</td>
    </tr>`,
    )
    .join('');

  const date = new Date(order.createdAt).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const discountRow =
    order.discountAmount > 0
      ? `<tr><td>Descuento${order.coupon ? ` (${order.coupon.code})` : ''}</td><td>-$${order.discountAmount.toLocaleString('es-CO')}</td></tr>`
      : '';

  const shippingRow =
    shippingCost === 0
      ? `<tr><td>Envio</td><td>Gratis</td></tr>`
      : `<tr><td>Envio</td><td>$${shippingCost.toLocaleString('es-CO')}</td></tr>`;

  const paymentRefRow = order.paymentReference
    ? `<div class="info-item"><label>Referencia ePayco</label><span>${order.paymentReference}</span></div>`
    : '';

  const deptStr = order.shippingDepartment ? `, ${order.shippingDepartment}` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Comprobante de Pago - KPU Cafe</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;color:#333;padding:32px;max-width:700px;margin:0 auto}
    .header{text-align:center;border-bottom:2px solid #6B3F1A;padding-bottom:16px;margin-bottom:24px}
    .header h1{font-size:22px;color:#6B3F1A;margin-top:8px}
    .header p{color:#888;font-size:12px}
    .section{margin-bottom:20px}
    .section-title{font-size:12px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .info-item label{font-size:11px;color:#888;display:block}
    .info-item span{font-weight:600}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;padding:8px 4px;border-bottom:2px solid #6B3F1A;font-size:11px;text-transform:uppercase;color:#888}
    .totals{margin-top:12px}
    .totals td:first-child{color:#666}
    .totals td:last-child{text-align:right;font-weight:600}
    .totals td{padding:4px}
    .total-final td{font-size:15px;color:#6B3F1A;border-top:2px solid #6B3F1A;padding-top:8px}
    .footer{text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa}
    @media print{body{padding:16px}}
  </style>
</head>
<body>
  <div class="header">
    <h1>KPU Cafe</h1>
    <p>Comprobante de Pago</p>
  </div>

  <div class="section">
    <div class="section-title">Informacion del pedido</div>
    <div class="info-grid">
      <div class="info-item"><label>Numero de pedido</label><span>#${order.id.slice(0, 8).toUpperCase()}</span></div>
      <div class="info-item"><label>Fecha</label><span>${date}</span></div>
      ${paymentRefRow}
      <div class="info-item"><label>Estado</label><span>Pagado</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos del destinatario</div>
    <div class="info-grid">
      <div class="info-item"><label>Nombre</label><span>${order.shippingName}</span></div>
      <div class="info-item"><label>Telefono</label><span>${order.shippingPhone}</span></div>
      <div class="info-item" style="grid-column:span 2"><label>Direccion de envio</label><span>${order.shippingAddress}, ${order.shippingCity}${deptStr}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Productos</div>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th style="text-align:center">Cant.</th>
          <th style="text-align:right">Precio unit.</th>
          <th style="text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <table class="totals">
      <tbody>
        <tr><td>Subtotal</td><td>$${subtotal.toLocaleString('es-CO')}</td></tr>
        ${discountRow}
        ${shippingRow}
        <tr class="total-final"><td><strong>Total</strong></td><td><strong>$${order.total.toLocaleString('es-CO')}</strong></td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>kpucafe.com &nbsp;&bull;&nbsp; Cafe especial colombiano</p>
    <p>Gracias por tu compra!</p>
  </div>
</body>
</html>`;
}

export function printInvoice(order: InvoiceOrder): void {
  const html = buildInvoiceHtml(order);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('No se pudo generar la factura');
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  setTimeout(() => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  }, 1000);
}
