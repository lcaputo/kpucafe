const ENVIA_SHIPPING_URL = 'https://api.envia.com';
const ENVIA_QUERIES_URL = 'https://queries.envia.com';

// --- Types ---

export interface EnviaAddress {
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface EnviaPackage {
  content: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  declaredValue: number;
}

export interface EnviaRateParams {
  apiToken: string;
  carrier: string;
  origin: EnviaAddress;
  destination: EnviaAddress;
  packages: EnviaPackage[];
}

export interface EnviaRateResult {
  carrier: string;
  service: string;
  serviceDescription: string;
  deliveryEstimate: string;
  totalPrice: number;
  currency: string;
}

export interface EnviaGenerateParams extends EnviaRateParams {
  service: string;
  orderReference?: string;
}

export interface EnviaGenerateResult {
  shipmentId: number;
  trackingNumber: string;
  trackUrl: string;
  labelUrl: string;
  totalPrice: number;
  carrier: string;
  service: string;
}

export interface EnviaTrackParams {
  apiToken: string;
  trackingNumbers: string[];
}

export interface EnviaTrackResult {
  trackingNumber: string;
  status: string;
  carrier: string;
  events: Array<{
    timestamp: string;
    description: string;
    location?: string;
  }>;
}

export interface EnviaPickupParams {
  apiToken: string;
  carrier: string;
  pickupDate: string;
  pickupTimeStart: string;
  pickupTimeEnd: string;
  pickupAddress: EnviaAddress;
  trackingNumbers: string[];
}

export interface EnviaCancelParams {
  apiToken: string;
  carrier: string;
  trackingNumber: string;
}

export interface EnviaWebhookParams {
  apiToken: string;
  url: string;
  typeId?: number;
}

// --- Error class ---

export class EnviaApiError extends Error {
  constructor(public code: number, message: string) {
    super(`Envia API error (${code}): ${message}`);
    this.name = 'EnviaApiError';
  }
}

// --- Shared POST helper ---

export async function enviaPost<T>(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  apiToken: string,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.meta === 'error') {
    throw new EnviaApiError(
      res.status,
      data.message || JSON.stringify(data),
    );
  }

  if (!res.ok) {
    throw new EnviaApiError(res.status, data.message || JSON.stringify(data));
  }

  return data as T;
}

// --- API Functions ---

export async function enviaRate(params: EnviaRateParams): Promise<EnviaRateResult> {
  const data = await enviaPost<any>(
    ENVIA_SHIPPING_URL,
    '/ship/rate/',
    {
      origin: params.origin,
      destination: params.destination,
      packages: params.packages.map((pkg) => ({
        ...pkg,
        type: 'box',
        amount: 1,
        lengthUnit: 'CM',
        weightUnit: 'KG',
        additionalServices: ['envia_insurance'],
      })),
      shipment: {
        type: 1,
        carrier: params.carrier,
      },
      settings: {
        currency: 'COP',
      },
    },
    params.apiToken,
  );

  const rate = data.data[0];
  return {
    carrier: rate.carrier,
    service: rate.service,
    serviceDescription: rate.serviceDescription,
    deliveryEstimate: rate.deliveryEstimate,
    totalPrice: Number(rate.totalPrice),
    currency: rate.currency,
  };
}

export async function enviaGenerate(params: EnviaGenerateParams): Promise<EnviaGenerateResult> {
  const data = await enviaPost<any>(
    ENVIA_SHIPPING_URL,
    '/ship/generate/',
    {
      origin: params.origin,
      destination: params.destination,
      packages: params.packages.map((pkg) => ({
        ...pkg,
        type: 'box',
        amount: 1,
        lengthUnit: 'CM',
        weightUnit: 'KG',
        additionalServices: ['envia_insurance'],
      })),
      shipment: {
        type: 1,
        carrier: params.carrier,
        service: params.service,
        orderReference: params.orderReference,
      },
      settings: {
        currency: 'COP',
        printFormat: 'PDF',
        printSize: 'PAPER_4X6',
      },
    },
    params.apiToken,
  );

  const result = data.data[0];
  return {
    shipmentId: Number(result.shipmentId),
    trackingNumber: result.trackingNumber,
    trackUrl: result.trackUrl,
    labelUrl: result.labelUrl,
    totalPrice: Number(result.totalPrice),
    carrier: result.carrier,
    service: result.service,
  };
}

export async function enviaTrack(params: EnviaTrackParams): Promise<EnviaTrackResult[]> {
  const data = await enviaPost<any>(
    ENVIA_SHIPPING_URL,
    '/ship/generaltrack/',
    { trackingNumbers: params.trackingNumbers },
    params.apiToken,
  );

  return (data.data as any[]).map((item) => ({
    trackingNumber: item.trackingNumber,
    status: item.status,
    carrier: item.carrier,
    events: (item.events || []).map((e: any) => ({
      timestamp: e.timestamp,
      description: e.description,
      location: e.location,
    })),
  }));
}

export async function enviaPickup(params: EnviaPickupParams): Promise<void> {
  await enviaPost(
    ENVIA_SHIPPING_URL,
    '/ship/pickup/',
    {
      carrier: params.carrier,
      pickupDate: params.pickupDate,
      pickupTimeStart: params.pickupTimeStart,
      pickupTimeEnd: params.pickupTimeEnd,
      pickupAddress: params.pickupAddress,
      trackingNumbers: params.trackingNumbers,
    },
    params.apiToken,
  );
}

export async function enviaCancel(params: EnviaCancelParams): Promise<void> {
  await enviaPost(
    ENVIA_SHIPPING_URL,
    '/ship/cancel/',
    {
      carrier: params.carrier,
      trackingNumber: params.trackingNumber,
    },
    params.apiToken,
  );
}

export async function enviaRegisterWebhook(params: EnviaWebhookParams): Promise<void> {
  await enviaPost(
    ENVIA_QUERIES_URL,
    '/webhooks',
    {
      type_id: params.typeId ?? 3,
      url: params.url,
      active: 1,
    },
    params.apiToken,
  );
}
