import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = 'KPU Cafe <noreply@kpucafe.com>';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kpucafe.com';

const formatOrderId = (orderId: string): string => orderId.slice(0, 8).toUpperCase();

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

const wrap = (content: string): string => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: 'Open Sans', sans-serif; line-height: 1.6; color: #333; }
      .button { background-color: #2D1810; color: white !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; }
    </style>
  </head>
  <body style="margin: 0; padding: 20px; background-color: #f9f9f9;">
    <div style="max-width: 600px; margin: 0 auto;">
      <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #ddd; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="padding: 24px; background-color: #2D1810; border-radius: 12px 12px 0 0;">
            <h1 style="color: #D4A574; font-size: 28px; margin: 0; font-family: 'Paytone One', sans-serif;">KPU Cafe</h1>
          </td>
        </tr>
        ${content}
        <tr>
          <td style="padding: 24px; background-color: #f5f5f5; border-radius: 0 0 12px 12px; font-size: 12px; color: #666;">
            <p style="margin: 0 0 8px 0;">KPU Cafe - Cafe Especializado Colombiano</p>
            <p style="margin: 0;">Visita <a href="${SITE_URL}" style="color: #2D1810;">${SITE_URL}</a> para hacer tus proximos pedidos en linea.</p>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>
`;

const registrationBlock = (token: string): string => `
<tr>
  <td style="padding: 0 24px 24px 24px;">
    <div style="background-color: #FFF8F0; border: 1px solid #D4A574; border-radius: 8px; padding: 16px;">
      <p style="margin: 0 0 12px 0; font-weight: bold; color: #2D1810;">Crea tu cuenta en KPU Cafe</p>
      <p style="margin: 0 0 12px 0; font-size: 14px;">Completa tu registro para hacer pedidos en linea, ver el historial de tus compras y recibir ofertas exclusivas.</p>
      <a href="${SITE_URL}/completar-registro?token=${encodeURIComponent(token)}" class="button" style="color: white;">Completar mi registro</a>
    </div>
  </td>
</tr>
`;

// Email 1: Domicilio created / order received
export async function sendDomicilioCreatedEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
  items: Array<{ productName: string; quantity: number; unitPrice: number }>;
  total: number;
  scheduledDate: string;
  registrationComplete: boolean;
  registrationToken?: string;
}): Promise<void> {
  if (!resend) return;

  const itemsHtml = data.items
    .map((item) => `<li>${escapeHtml(item.productName)} x${item.quantity} — $${(item.unitPrice * item.quantity).toLocaleString('es-CO')}</li>`)
    .join('');

  const html = wrap(`
    <tr>
      <td style="padding: 24px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">Pedido #${formatOrderId(data.orderId)}</p>
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${escapeHtml(data.customerName)},</p>
        <p style="margin: 0 0 16px 0;">Tu pedido ha sido recibido y estamos preparando tu cafe especializado.</p>
        <p style="margin: 0 0 8px 0;"><strong>Entrega:</strong> ${data.scheduledDate}</p>
        <p style="margin: 0 0 8px 0;"><strong>Productos:</strong></p>
        <ul style="margin: 0 0 16px 0; padding-left: 20px;">${itemsHtml}</ul>
        <p style="margin: 0; font-size: 18px; font-weight: bold;">Total: $${data.total.toLocaleString('es-CO')}</p>
      </td>
    </tr>
    ${!data.registrationComplete && data.registrationToken ? registrationBlock(data.registrationToken) : ''}
  `);

  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Pedido recibido #${formatOrderId(data.orderId)} - KPU Cafe`,
    html,
  });
}

// Email 2: Domicilio en camino
export async function sendDomicilioEnCaminoEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
  driverName?: string;
  driverPhone?: string;
  trackingUrl?: string;
  registrationComplete: boolean;
  registrationToken?: string;
}): Promise<void> {
  if (!resend) return;

  const driverInfo = data.driverName
    ? `<p style="margin: 0 0 8px 0;"><strong>Mensajero:</strong> ${escapeHtml(data.driverName)}${data.driverPhone ? ` — ${escapeHtml(data.driverPhone)}` : ''}</p>`
    : '';

  const trackingBtn = data.trackingUrl
    ? `<p style="margin: 16px 0;"><a href="${data.trackingUrl}" class="button" style="color: white;">Ver seguimiento en vivo</a></p>`
    : '';

  const html = wrap(`
    <tr>
      <td style="padding: 24px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">Pedido #${formatOrderId(data.orderId)}</p>
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${escapeHtml(data.customerName)},</p>
        <p style="margin: 0 0 16px 0;">Tu pedido esta en camino hacia ti.</p>
        ${driverInfo}
        ${trackingBtn}
      </td>
    </tr>
    ${!data.registrationComplete && data.registrationToken ? registrationBlock(data.registrationToken) : ''}
  `);

  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido esta en camino #${formatOrderId(data.orderId)} - KPU Cafe`,
    html,
  });
}

// Email 3: Domicilio entregado
export async function sendDomicilioEntregadoEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
  registrationComplete: boolean;
  registrationToken?: string;
}): Promise<void> {
  if (!resend) return;

  const html = wrap(`
    <tr>
      <td style="padding: 24px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">Pedido #${formatOrderId(data.orderId)}</p>
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${escapeHtml(data.customerName)},</p>
        <p style="margin: 0 0 16px 0;">Tu pedido ha sido entregado exitosamente. Esperamos que disfrutes tu cafe KPU.</p>
        <p style="margin: 0 0 16px 0;">Gracias por tu compra. Estamos listos para tu proximo pedido.</p>
      </td>
    </tr>
    ${!data.registrationComplete && data.registrationToken ? registrationBlock(data.registrationToken) : ''}
  `);

  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Pedido entregado #${formatOrderId(data.orderId)} - KPU Cafe`,
    html,
  });
}
