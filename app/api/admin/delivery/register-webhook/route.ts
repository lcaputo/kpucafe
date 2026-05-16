import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { muRegisterWebhook } from '@/lib/mensajeros-urbanos';
import { getMuConfig } from '@/lib/delivery-config';
import { log } from '@/lib/logger';

export async function POST() {
  try {
    await requireAdmin();

    const muConfig = getMuConfig();

    if (!muConfig.accessToken) {
      return NextResponse.json({ message: 'MU_ACCESS_TOKEN no configurado' }, { status: 400 });
    }
    if (!muConfig.webhookToken) {
      return NextResponse.json({ message: 'MU_WEBHOOK_TOKEN no configurado' }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
    if (!siteUrl) {
      return NextResponse.json({ message: 'NEXT_PUBLIC_SITE_URL no configurado' }, { status: 400 });
    }

    const endpoint = `${siteUrl}/api/delivery/mu-webhook`;

    await muRegisterWebhook({
      accessToken: muConfig.accessToken,
      endpoint,
      tokenEndpoint: muConfig.webhookToken,
    });

    log({
      level: 'info',
      type: 'delivery',
      action: 'mu_webhook_registered',
      message: `MU webhook registrado: ${endpoint}`,
    });

    return NextResponse.json({ message: 'Webhook registrado exitosamente', endpoint });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    log({ level: 'error', type: 'delivery', action: 'mu_webhook_register_failed', message: err.message, error: err.stack });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
