import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = 'KPU Cafe <noreply@kpucafe.com>';

async function send(options: Parameters<Resend['emails']['send']>[0]) {
  if (!resend) return;
  await send(options);
}

// Helper: Format order ID as first 8 chars uppercase
const formatOrderId = (orderId: string): string => orderId.slice(0, 8).toUpperCase();

// Helper: Reusable order header for emails
const orderHeader = (orderId: string): string => {
  return `
    <tr>
      <td style="padding: 24px; background-color: #2D1810; border-radius: 12px 12px 0 0;">
        <h1 style="color: #D4A574; font-size: 28px; margin: 0; font-family: 'Paytone One', sans-serif;">KPU Cafe</h1>
        <p style="color: #D4A574; margin: 8px 0 0 0; font-size: 14px;">Pedido #${formatOrderId(orderId)}</p>
      </td>
    </tr>
  `;
};

// Helper: Reusable email footer
const emailFooter = (): string => {
  return `
    <tr>
      <td style="padding: 24px; background-color: #f5f5f5; border-radius: 0 0 12px 12px; font-size: 12px; color: #666;">
        <p style="margin: 0 0 8px 0;">KPU Cafe - Café Especializado Colombiano</p>
        <p style="margin: 0;">Para preguntas o asistencia, contáctanos a través de nuestra plataforma.</p>
      </td>
    </tr>
  `;
};

// Helper: Wrap content in email container
const wrap = (content: string): string => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Open Sans', sans-serif; line-height: 1.6; color: #333; }
          a { color: #2D1810; text-decoration: none; }
          .container { max-width: 600px; margin: 0 auto; }
          .button { background-color: #2D1810; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; }
          .button:hover { background-color: #1a0f07; }
        </style>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f9f9f9;">
        <div class="container">
          <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #ddd; border-radius: 12px; overflow: hidden;">
            ${content}
          </table>
        </div>
      </body>
    </html>
  `;
};

// Email 1: Order Preparing
export async function sendOrderPreparingEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
  scheduledDate?: string;
}): Promise<void> {
  const body = `
    ${orderHeader(data.orderId)}
    <tr>
      <td style="padding: 24px; background-color: white;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${data.customerName},</p>
        <p style="margin: 0 0 16px 0;">Tu pedido ha sido confirmado y estamos preparando tu café especializado con cuidado.</p>
        <p style="margin: 0 0 16px 0;"><strong>Pago confirmado</strong> - Tu transacción fue procesada exitosamente.</p>
        ${data.scheduledDate ? `<p style="margin: 0 0 16px 0;"><strong>Fecha de entrega programada:</strong> ${data.scheduledDate}</p>` : ''}
        <p style="margin: 0 0 24px 0;">Te coordinaremos la entrega en las próximas horas. Verifica el estado del pedido en cualquier momento.</p>
        <p style="margin: 0 0 24px 0;">
          <a href="https://kpucafe.com/pedido/${data.orderId}" class="button">Ver detalles del pedido</a>
        </p>
      </td>
    </tr>
    ${emailFooter()}
  `;

  await send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${formatOrderId(data.orderId)} esta en preparacion`,
    html: wrap(body),
  });
}

// Email 2: Driver Assigned
export async function sendDriverAssignedEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
  driverName: string;
  driverPhone: string;
  driverPlate: string;
  trackingUrl?: string;
  eta?: string;
}): Promise<void> {
  const body = `
    ${orderHeader(data.orderId)}
    <tr>
      <td style="padding: 24px; background-color: white;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${data.customerName},</p>
        <p style="margin: 0 0 24px 0;">Un mensajero ha sido asignado para recoger tu pedido.</p>

        <div style="background-color: #f9f9f9; padding: 16px; border-radius: 8px; margin: 0 0 24px 0;">
          <p style="margin: 0 0 12px 0; font-weight: bold;">Información del mensajero</p>
          <p style="margin: 0 0 8px 0;"><strong>Nombre:</strong> ${data.driverName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Teléfono:</strong> <a href="tel:${data.driverPhone}">${data.driverPhone}</a></p>
          <p style="margin: 0 0 8px 0;"><strong>Vehículo:</strong> ${data.driverPlate}</p>
          ${data.eta ? `<p style="margin: 0;"><strong>Hora estimada:</strong> ${data.eta}</p>` : ''}
        </div>

        ${data.trackingUrl ? `<p style="margin: 0 0 24px 0;"><a href="${data.trackingUrl}" class="button">Rastrear envío</a></p>` : ''}
        <p style="margin: 0;"><a href="https://kpucafe.com/pedido/${data.orderId}" class="button">Ver pedido</a></p>
      </td>
    </tr>
    ${emailFooter()}
  `;

  await send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Un mensajero recogera tu pedido #${formatOrderId(data.orderId)}`,
    html: wrap(body),
  });
}

// Email 3: Order Picking Up
export async function sendOrderPickingUpEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
}): Promise<void> {
  const body = `
    ${orderHeader(data.orderId)}
    <tr>
      <td style="padding: 24px; background-color: white;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${data.customerName},</p>
        <p style="margin: 0 0 24px 0;">El mensajero ha llegado a nuestro local y está recogiendo tu pedido en este momento.</p>
        <p style="margin: 0 0 24px 0;">Tu café estará en camino pronto.</p>
        <p style="margin: 0;"><a href="https://kpucafe.com/pedido/${data.orderId}" class="button">Ver detalles</a></p>
      </td>
    </tr>
    ${emailFooter()}
  `;

  await send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${formatOrderId(data.orderId)} esta siendo recogido`,
    html: wrap(body),
  });
}

// Email 4: Order On The Way
export async function sendOrderOnTheWayEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
  driverName: string;
  driverPhone: string;
  driverPlate: string;
  trackingUrl?: string;
}): Promise<void> {
  const body = `
    ${orderHeader(data.orderId)}
    <tr>
      <td style="padding: 24px; background-color: white;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${data.customerName},</p>
        <p style="margin: 0 0 24px 0;">Tu pedido está en camino hacia ti.</p>

        <div style="background-color: #f9f9f9; padding: 16px; border-radius: 8px; margin: 0 0 24px 0;">
          <p style="margin: 0 0 12px 0; font-weight: bold;">Información del mensajero</p>
          <p style="margin: 0 0 8px 0;"><strong>Nombre:</strong> ${data.driverName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Teléfono:</strong> <a href="tel:${data.driverPhone}">${data.driverPhone}</a></p>
          <p style="margin: 0;"><strong>Vehículo:</strong> ${data.driverPlate}</p>
        </div>

        ${data.trackingUrl ? `<p style="margin: 0 0 24px 0;"><a href="${data.trackingUrl}" class="button">Rastrear envío</a></p>` : ''}
        <p style="margin: 0;"><a href="https://kpucafe.com/pedido/${data.orderId}" class="button">Ver pedido</a></p>
      </td>
    </tr>
    ${emailFooter()}
  `;

  await send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${formatOrderId(data.orderId)} va en camino`,
    html: wrap(body),
  });
}

// Email 5: Order Delivered
export async function sendOrderDeliveredEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
}): Promise<void> {
  const body = `
    ${orderHeader(data.orderId)}
    <tr>
      <td style="padding: 24px; background-color: white;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${data.customerName},</p>
        <p style="margin: 0 0 24px 0;"><strong>¡Tu pedido ha sido entregado!</strong></p>
        <p style="margin: 0 0 24px 0;">Esperamos que disfrutes tu café especializado de KPU Cafe. Gracias por tu compra.</p>
        <p style="margin: 0 0 24px 0;">Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.</p>
        <p style="margin: 0;"><a href="https://kpucafe.com" class="button">Volver a la tienda</a></p>
      </td>
    </tr>
    ${emailFooter()}
  `;

  await send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${formatOrderId(data.orderId)} fue entregado`,
    html: wrap(body),
  });
}

// Email 6: Envia Shipped
export async function sendEnviaShippedEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
  carrier: string;
  trackingNumber: string;
  trackUrl: string;
  deliveryEstimate: string;
}): Promise<void> {
  const body = `
    ${orderHeader(data.orderId)}
    <tr>
      <td style="padding: 24px; background-color: white;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${data.customerName},</p>
        <p style="margin: 0 0 24px 0;">Tu pedido ha sido despachado y sera enviado con ${data.carrier}.</p>

        <div style="background-color: #f9f9f9; padding: 16px; border-radius: 8px; margin: 0 0 24px 0;">
          <p style="margin: 0 0 12px 0; font-weight: bold;">Información del envío</p>
          <p style="margin: 0 0 8px 0;"><strong>Transportista:</strong> ${data.carrier}</p>
          <p style="margin: 0 0 8px 0;"><strong>Número de rastreo:</strong> ${data.trackingNumber}</p>
          <p style="margin: 0;"><strong>Entrega estimada:</strong> ${data.deliveryEstimate}</p>
        </div>

        <p style="margin: 0 0 24px 0;"><a href="${data.trackUrl}" class="button">Rastrear envío</a></p>
        <p style="margin: 0;"><a href="https://kpucafe.com/pedido/${data.orderId}" class="button">Ver pedido</a></p>
      </td>
    </tr>
    ${emailFooter()}
  `;

  await send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${formatOrderId(data.orderId)} sera enviado con ${data.carrier}`,
    html: wrap(body),
  });
}

// Email 7: Envia In Transit
export async function sendEnviaInTransitEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
  carrier: string;
  trackUrl: string;
}): Promise<void> {
  const body = `
    ${orderHeader(data.orderId)}
    <tr>
      <td style="padding: 24px; background-color: white;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${data.customerName},</p>
        <p style="margin: 0 0 24px 0;">Tu pedido va en camino con ${data.carrier}.</p>
        <p style="margin: 0 0 24px 0;"><a href="${data.trackUrl}" class="button">Rastrear envío</a></p>
        <p style="margin: 0;"><a href="https://kpucafe.com/pedido/${data.orderId}" class="button">Ver pedido</a></p>
      </td>
    </tr>
    ${emailFooter()}
  `;

  await send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${formatOrderId(data.orderId)} va en camino`,
    html: wrap(body),
  });
}

// Email 8: Envia Out For Delivery
export async function sendEnviaOutForDeliveryEmail(data: {
  to: string;
  orderId: string;
  customerName: string;
}): Promise<void> {
  const body = `
    ${orderHeader(data.orderId)}
    <tr>
      <td style="padding: 24px; background-color: white;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hola ${data.customerName},</p>
        <p style="margin: 0 0 24px 0;">Tu pedido esta en reparto. Sera entregado hoy.</p>
        <p style="margin: 0;"><a href="https://kpucafe.com/pedido/${data.orderId}" class="button">Ver pedido</a></p>
      </td>
    </tr>
    ${emailFooter()}
  `;

  await send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Tu pedido #${formatOrderId(data.orderId)} esta en reparto`,
    html: wrap(body),
  });
}
