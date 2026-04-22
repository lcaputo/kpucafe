const MU_BASE = 'https://mu-integraciones.mensajerosurbanos.com';

// ---------------------------------------------------------------------------
// City IDs
// ---------------------------------------------------------------------------

export const MU_CITY_IDS = {
  Bogota: 1,
  Cali: 2,
  Medellin: 3,
  Barranquilla: 4,
  Cartagena: 8,
} as const;

export type MuCityId = (typeof MU_CITY_IDS)[keyof typeof MU_CITY_IDS];

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class MuApiError extends Error {
  status: number;
  constructor(message: string, status: number = 0) {
    super(message);
    this.name = 'MuApiError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Shared interfaces
// ---------------------------------------------------------------------------

export interface MuCoordinate {
  /** 'origin' | 'destination' */
  type: 'origin' | 'destination';
  lat: number;
  lng: number;
  address: string;
  /** Used in muCreateService */
  client_data?: MuClientData;
  products?: MuProduct[];
}

export interface MuClientData {
  name: string;
  phone: string;
}

export interface MuProduct {
  description: string;
  quantity: number;
  value: number;
}

// ---------------------------------------------------------------------------
// muCalculate
// ---------------------------------------------------------------------------

export interface MuCalculateParams {
  accessToken: string;
  declaredValue: number;
  city: MuCityId;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
}

export interface MuCalculateResult {
  totalService: number;
  totalDistance: number;
  baseValue: number;
  distanceSurcharge: number;
  insuranceSurcharge: number;
}

export async function muCalculate(params: MuCalculateParams): Promise<MuCalculateResult> {
  const body = {
    access_token: params.accessToken,
    type_service: 4,
    roundtrip: 0,
    declared_value: params.declaredValue,
    city: params.city,
    parking_surcharge: 0,
    coordinates: [
      { type: 'origin', lat: params.origin.lat, lng: params.origin.lng },
      { type: 'destination', lat: params.destination.lat, lng: params.destination.lng },
    ],
  };

  const data = await muPost<MuCalculateResult>('/api/calculate', body);
  return {
    totalService: data.totalService,
    totalDistance: data.totalDistance,
    baseValue: data.baseValue,
    distanceSurcharge: data.distanceSurcharge,
    insuranceSurcharge: data.insuranceSurcharge,
  };
}

// ---------------------------------------------------------------------------
// muCreateService
// ---------------------------------------------------------------------------

export interface MuCreateAddressParams {
  lat: number;
  lng: number;
  address: string;
  clientName: string;
  clientPhone: string;
  products: MuProduct[];
}

export interface MuCreateServiceParams {
  accessToken: string;
  declaredValue: number;
  city: MuCityId;
  startDate: string; // YYYY-mm-dd
  startTime: string; // HH:MM:ss
  origin: MuCreateAddressParams;
  destination: MuCreateAddressParams;
  observation: string;
}

export interface MuCreateServiceResult {
  taskId: string;
  uuid: string;
  status: string;
  total: number;
  distance: number;
}

export async function muCreateService(params: MuCreateServiceParams): Promise<MuCreateServiceResult> {
  const toCoord = (addr: MuCreateAddressParams, type: 'origin' | 'destination'): MuCoordinate => ({
    type,
    lat: addr.lat,
    lng: addr.lng,
    address: addr.address,
    client_data: { name: addr.clientName, phone: addr.clientPhone },
    products: addr.products,
  });

  const body = {
    access_token: params.accessToken,
    type_service: 4,
    roundtrip: 0,
    declared_value: params.declaredValue,
    city: params.city,
    start_date: params.startDate,
    start_time: params.startTime,
    os: 'NEW API 2.0',
    coordinates: [
      toCoord(params.origin, 'origin'),
      toCoord(params.destination, 'destination'),
    ],
    observation: params.observation,
  };

  const data = await muPost<MuCreateServiceResult>('/api/create', body);
  return {
    taskId: data.taskId,
    uuid: data.uuid,
    status: data.status,
    total: data.total,
    distance: data.distance,
  };
}

// ---------------------------------------------------------------------------
// muTrack
// ---------------------------------------------------------------------------

export interface MuTrackParams {
  accessToken: string;
  uuid: string;
}

export interface MuDriverInfo {
  name: string;
  phone: string;
  plate: string;
  vehicleType: string;
  photo: string | null;
}

export interface MuTrackAddress {
  type: string;
  address: string;
}

export interface MuTrackHistoryEntry {
  statusId: number;
  statusName: string;
  timestamp: string;
}

export interface MuTrackResult {
  taskId: string;
  statusId: number;
  statusName: string;
  driver: MuDriverInfo | null;
  addresses: MuTrackAddress[];
  history: MuTrackHistoryEntry[];
}

export async function muTrack(params: MuTrackParams): Promise<MuTrackResult> {
  const body = {
    access_token: params.accessToken,
    uuid: params.uuid,
  };

  const data = await muPost<MuTrackResult>('/api/track', body);
  return {
    taskId: data.taskId,
    statusId: data.statusId,
    statusName: data.statusName,
    driver: data.driver ?? null,
    addresses: data.addresses ?? [],
    history: data.history ?? [],
  };
}

// ---------------------------------------------------------------------------
// muCancel
// ---------------------------------------------------------------------------

export interface MuCancelParams {
  accessToken: string;
  taskUuid: string;
  /** 1–4 */
  cancellationType: number;
  description: string;
}

export async function muCancel(params: MuCancelParams): Promise<void> {
  // NOTE: The MU API has a typo — the field is `acces_token` (single 's')
  const body = {
    acces_token: params.accessToken,
    task_uuid: params.taskUuid,
    cancellation_type: params.cancellationType,
    description: params.description,
  };

  await muPost<unknown>('/api/cancel', body);
}

// ---------------------------------------------------------------------------
// muAddStore
// ---------------------------------------------------------------------------

export interface MuAddStoreParams {
  accessToken: string;
  idPoint: string;
  name: string;
  address: string;
  city: MuCityId;
  phone: string;
}

export async function muAddStore(params: MuAddStoreParams): Promise<void> {
  const body = {
    access_token: params.accessToken,
    id_point: params.idPoint,
    name: params.name,
    address: params.address,
    city: params.city,
    phone: params.phone,
  };

  await muPost<unknown>('/api/Add-store', body);
}

// ---------------------------------------------------------------------------
// muRegisterWebhook
// ---------------------------------------------------------------------------

export interface MuRegisterWebhookParams {
  accessToken: string;
  endpoint: string;
  tokenEndpoint: string;
}

export async function muRegisterWebhook(params: MuRegisterWebhookParams): Promise<void> {
  const body = {
    access_token: params.accessToken,
    endpoint: params.endpoint,
    token_endpoint: params.tokenEndpoint,
  };

  await muPost<unknown>('/api/webhook', body);
}

// ---------------------------------------------------------------------------
// Shared POST helper
// ---------------------------------------------------------------------------

async function muPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${MU_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new MuApiError(
      `Error de red al contactar Mensajeros Urbanos: ${(err as Error).message}`,
      0,
    );
  }

  if (!res.ok) {
    let message = `Mensajeros Urbanos API error: HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error) message = String(errBody.error);
      else if (errBody?.message) message = String(errBody.message);
    } catch {
      // ignore JSON parse errors — keep the HTTP status message
    }
    throw new MuApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}
