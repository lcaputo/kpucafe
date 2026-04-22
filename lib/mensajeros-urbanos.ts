const MU_BASE_URL = 'https://mu-integraciones.mensajerosurbanos.com';

export const MU_CITY_IDS: Record<string, number> = {
  Barranquilla: 4,
  Bogota: 1,
  Cali: 2,
  Medellin: 3,
  Cartagena: 8,
};

// --- Types ---

export interface MuCalculateParams {
  accessToken: string;
  cityId: number;
  declaredValue: number;
  originAddress: string;
  destinationAddress: string;
}

export interface MuCalculateResult {
  totalService: number;
  totalDistance: string;
  baseValue: number;
  distanceSurcharge: number;
  insuranceSurcharge: number;
}

export interface MuDestination {
  address: string;
  orderId: string;
  description: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  paymentType: '1' | '2' | '3';
  productsValue: number;
  domicileValue: string;
}

export interface MuProduct {
  storeId: string;
  productName: string;
  quantity: number;
  value: number;
  sku?: string;
}

export interface MuCreateParams {
  accessToken: string;
  cityId: number;
  declaredValue: number;
  startDate: string; // YYYY-mm-dd
  startTime: string; // HH:MM:ss
  storeId: string;
  destination: MuDestination;
  products: MuProduct[];
  observation?: string;
}

export interface MuCreateResult {
  taskId: number;
  uuid: string;
  status: number;
  total: number;
  distance: string;
}

export interface MuTrackParams {
  accessToken: string;
  uuid: string;
}

export interface MuDriver {
  name: string;
  phone: string;
  plate: string;
  vehicleType: string;
  photo: string;
}

export interface MuTrackResult {
  taskId: number;
  statusId: number;
  statusName: string;
  driver: MuDriver | null;
  addresses: Array<{ address: string; status: number }>;
  history: Array<{ statusId: number; status: string; date: string }>;
}

export interface MuCancelParams {
  accessToken: string;
  uuid: string;
  cancellationType: 1 | 2 | 3 | 4;
  description: string;
}

export interface MuAddStoreParams {
  accessToken: string;
  idPoint: string;
  name: string;
  address: string;
  city: string;
  phone?: string;
}

export interface MuRegisterWebhookParams {
  accessToken: string;
  endpoint: string;
  tokenEndpoint: string;
}

// --- Error class ---

export class MuApiError extends Error {
  constructor(public status: number, message: string) {
    super(`MU API error (${status}): ${message}`);
    this.name = 'MuApiError';
  }
}

// --- Shared POST helper ---

async function muPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${MU_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new MuApiError(res.status, data.message || JSON.stringify(data));
  }
  return data as T;
}

// --- API Functions ---

export async function muCalculate(params: MuCalculateParams): Promise<MuCalculateResult> {
  const data = await muPost<any>('/api/calculate', {
    access_token: params.accessToken,
    type_service: 4,
    roundtrip: 0,
    declared_value: params.declaredValue,
    city: params.cityId,
    parking_surcharge: 0,
    coordinates: [
      { type: '1', address: params.originAddress },
      { type: '1', address: params.destinationAddress },
    ],
  });

  return {
    totalService: data.total_service,
    totalDistance: data.total_distance,
    baseValue: data.base_value,
    distanceSurcharge: data.distance_surcharge,
    insuranceSurcharge: data.insurance_surcharge,
  };
}

export async function muCreateService(params: MuCreateParams): Promise<MuCreateResult> {
  const data = await muPost<any>('/api/create', {
    access_token: params.accessToken,
    type_service: 4,
    roundtrip: 0,
    declared_value: params.declaredValue,
    city: params.cityId,
    start_date: params.startDate,
    start_time: params.startTime,
    os: 'NEW API 2.0',
    coordinates: [
      {
        type: '1',
        address: params.destination.address,
        order_id: params.destination.orderId,
        description: params.destination.description,
        client_data: {
          client_name: params.destination.clientName,
          client_phone: params.destination.clientPhone,
          client_email: params.destination.clientEmail || '',
          payment_type: params.destination.paymentType,
          products_value: params.destination.productsValue,
          domicile_value: params.destination.domicileValue,
        },
        products: params.products.map((p) => ({
          store_id: p.storeId,
          product_name: p.productName,
          quantity: p.quantity,
          value: p.value,
          sku: p.sku || '',
        })),
      },
    ],
    observation: params.observation || '',
  });

  return {
    taskId: data.task_id,
    uuid: data.uuid,
    status: data.status,
    total: data.total,
    distance: data.distance,
  };
}

export async function muTrack(params: MuTrackParams): Promise<MuTrackResult> {
  const data = await muPost<any>('/api/track', {
    access_token: params.accessToken,
    uuid: params.uuid,
  });

  const resource = data.resource;
  return {
    taskId: data.data?.task_id,
    statusId: data.data?.status_id,
    statusName: data.data?.status,
    driver: resource
      ? {
          name: resource.name,
          phone: resource.phone,
          plate: resource.plate_number,
          vehicleType: resource.type_resource_name,
          photo: resource.photo,
        }
      : null,
    addresses: (data.address || []).map((a: any) => ({
      address: a.address,
      status: a.status,
    })),
    history: (data.history || []).map((h: any) => ({
      statusId: h.status_id,
      status: h.status,
      date: h.date,
    })),
  };
}

export async function muCancel(params: MuCancelParams): Promise<void> {
  await muPost('/api/cancel', {
    acces_token: params.accessToken, // Note: MU API has typo "acces_token"
    task_uuid: params.uuid,
    cancellation_type: params.cancellationType,
    description: params.description,
  });
}

export async function muAddStore(params: MuAddStoreParams): Promise<void> {
  await muPost('/api/Add-store', {
    access_token: params.accessToken,
    id_point: params.idPoint,
    name: params.name,
    address: params.address,
    city: params.city,
    phone: params.phone || '',
  });
}

export async function muRegisterWebhook(params: MuRegisterWebhookParams): Promise<void> {
  await muPost('/api/webhook', {
    access_token: params.accessToken,
    endpoint: params.endpoint,
    token_endpoint: params.tokenEndpoint,
  });
}
