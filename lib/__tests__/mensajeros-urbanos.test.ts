import { vi, describe, it, expect, beforeEach } from 'vitest';

import {
  MU_CITY_IDS,
  MuApiError,
  muCalculate,
  muCreateService,
  muTrack,
  muCancel,
  muAddStore,
  muRegisterWebhook,
} from '@/lib/mensajeros-urbanos';

const MU_BASE = 'https://mu-integraciones.mensajerosurbanos.com';

// Helper: build a minimal fetch mock that returns ok JSON
function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('MU_CITY_IDS', () => {
  it('has Barranquilla = 4', () => expect(MU_CITY_IDS.Barranquilla).toBe(4));
  it('has Bogota = 1', () => expect(MU_CITY_IDS.Bogota).toBe(1));
  it('has Cali = 2', () => expect(MU_CITY_IDS.Cali).toBe(2));
  it('has Medellin = 3', () => expect(MU_CITY_IDS.Medellin).toBe(3));
  it('has Cartagena = 8', () => expect(MU_CITY_IDS.Cartagena).toBe(8));
});

describe('muCalculate', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('sends correct payload and returns mapped result', async () => {
    global.fetch = mockFetch({
      totalService: 15000,
      totalDistance: 5.2,
      baseValue: 12000,
      distanceSurcharge: 2000,
      insuranceSurcharge: 1000,
    });

    const result = await muCalculate({
      accessToken: 'tok-123',
      declaredValue: 50000,
      city: MU_CITY_IDS.Barranquilla,
      origin: { lat: 10.96, lng: -74.8 },
      destination: { lat: 10.97, lng: -74.81 },
    });

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${MU_BASE}/api/calculate`);
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string);
    expect(body.access_token).toBe('tok-123');
    expect(body.type_service).toBe(4);
    expect(body.roundtrip).toBe(0);
    expect(body.declared_value).toBe(50000);
    expect(body.city).toBe(4);
    expect(body.parking_surcharge).toBe(0);
    expect(body.coordinates).toBeDefined();

    expect(result.totalService).toBe(15000);
    expect(result.totalDistance).toBe(5.2);
    expect(result.baseValue).toBe(12000);
    expect(result.distanceSurcharge).toBe(2000);
    expect(result.insuranceSurcharge).toBe(1000);
  });

  it('includes origin and destination in coordinates', async () => {
    global.fetch = mockFetch({ totalService: 0, totalDistance: 0, baseValue: 0, distanceSurcharge: 0, insuranceSurcharge: 0 });

    await muCalculate({
      accessToken: 'tok',
      declaredValue: 1000,
      city: MU_CITY_IDS.Bogota,
      origin: { lat: 4.6, lng: -74.1 },
      destination: { lat: 4.61, lng: -74.11 },
    });

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    const coords: Array<{ type: string }> = body.coordinates;
    expect(coords.some((c) => c.type === 'origin')).toBe(true);
    expect(coords.some((c) => c.type === 'destination')).toBe(true);
  });

  it('throws MuApiError on API error', async () => {
    global.fetch = mockFetch({ error: 'Unauthorized' }, false, 401);

    await expect(
      muCalculate({
        accessToken: 'bad',
        declaredValue: 0,
        city: MU_CITY_IDS.Cali,
        origin: { lat: 0, lng: 0 },
        destination: { lat: 0, lng: 0 },
      })
    ).rejects.toBeInstanceOf(MuApiError);
  });
});

describe('muCreateService', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('sends correct payload and returns uuid + taskId', async () => {
    global.fetch = mockFetch({
      taskId: 'task-001',
      uuid: 'uuid-abc-123',
      status: 'pending',
      total: 18000,
      distance: 6.1,
    });

    const result = await muCreateService({
      accessToken: 'tok-456',
      declaredValue: 80000,
      city: MU_CITY_IDS.Medellin,
      startDate: '2026-04-21',
      startTime: '10:00:00',
      origin: {
        lat: 6.23,
        lng: -75.58,
        address: 'Calle 1 # 2-3',
        clientName: 'KPU Cafe',
        clientPhone: '3001234567',
        products: [{ description: 'Cafe', quantity: 2, value: 40000 }],
      },
      destination: {
        lat: 6.24,
        lng: -75.59,
        address: 'Carrera 5 # 6-7',
        clientName: 'Juan Perez',
        clientPhone: '3009876543',
        products: [],
      },
      observation: 'Entrega frágil',
    });

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${MU_BASE}/api/create`);

    const body = JSON.parse(init.body as string);
    expect(body.access_token).toBe('tok-456');
    expect(body.type_service).toBe(4);
    expect(body.roundtrip).toBe(0);
    expect(body.declared_value).toBe(80000);
    expect(body.city).toBe(3);
    expect(body.start_date).toBe('2026-04-21');
    expect(body.start_time).toBe('10:00:00');
    expect(body.os).toBe('NEW API 2.0');
    expect(body.observation).toBe('Entrega frágil');
    expect(Array.isArray(body.coordinates)).toBe(true);

    expect(result.taskId).toBe('task-001');
    expect(result.uuid).toBe('uuid-abc-123');
    expect(result.status).toBe('pending');
    expect(result.total).toBe(18000);
    expect(result.distance).toBe(6.1);
  });

  it('coordinates include client_data and products', async () => {
    global.fetch = mockFetch({ taskId: 't', uuid: 'u', status: 's', total: 0, distance: 0 });

    await muCreateService({
      accessToken: 'tok',
      declaredValue: 0,
      city: MU_CITY_IDS.Bogota,
      startDate: '2026-01-01',
      startTime: '09:00:00',
      origin: {
        lat: 4.6, lng: -74.1, address: 'Origen',
        clientName: 'Tienda', clientPhone: '300',
        products: [{ description: 'P', quantity: 1, value: 100 }],
      },
      destination: {
        lat: 4.61, lng: -74.11, address: 'Destino',
        clientName: 'Cliente', clientPhone: '301',
        products: [],
      },
      observation: '',
    });

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    const coords: Array<{ client_data?: unknown; products?: unknown }> = body.coordinates;
    expect(coords.every((c) => 'client_data' in c)).toBe(true);
    expect(coords.every((c) => 'products' in c)).toBe(true);
  });
});

describe('muTrack', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns structured data with driver info', async () => {
    global.fetch = mockFetch({
      taskId: 'task-999',
      statusId: 2,
      statusName: 'En camino',
      driver: {
        name: 'Carlos Lopez',
        phone: '3112223333',
        plate: 'ABC-123',
        vehicleType: 'moto',
        photo: 'https://example.com/photo.jpg',
      },
      addresses: [
        { type: 'origin', address: 'Calle 1' },
        { type: 'destination', address: 'Calle 2' },
      ],
      history: [
        { statusId: 1, statusName: 'Creado', timestamp: '2026-04-21T10:00:00Z' },
        { statusId: 2, statusName: 'En camino', timestamp: '2026-04-21T10:15:00Z' },
      ],
    });

    const result = await muTrack({ accessToken: 'tok', uuid: 'uuid-999' });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${MU_BASE}/api/track`);
    const body = JSON.parse(init.body as string);
    expect(body.access_token).toBe('tok');
    expect(body.uuid).toBe('uuid-999');

    expect(result.taskId).toBe('task-999');
    expect(result.statusId).toBe(2);
    expect(result.statusName).toBe('En camino');
    expect(result.driver).not.toBeNull();
    expect(result.driver?.name).toBe('Carlos Lopez');
    expect(result.driver?.plate).toBe('ABC-123');
    expect(result.addresses).toHaveLength(2);
    expect(result.history).toHaveLength(2);
  });

  it('returns null driver when not assigned', async () => {
    global.fetch = mockFetch({
      taskId: 'task-1',
      statusId: 1,
      statusName: 'Creado',
      driver: null,
      addresses: [],
      history: [],
    });

    const result = await muTrack({ accessToken: 'tok', uuid: 'uuid-1' });
    expect(result.driver).toBeNull();
  });
});

describe('muCancel', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('sends correct payload with the typo field acces_token', async () => {
    global.fetch = mockFetch({}, true, 200);

    await muCancel({
      accessToken: 'tok-cancel',
      taskUuid: 'uuid-to-cancel',
      cancellationType: 2,
      description: 'Cliente canceló',
    });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${MU_BASE}/api/cancel`);

    const body = JSON.parse(init.body as string);
    // The MU API has a typo: single 's' in acces_token
    expect(body.acces_token).toBe('tok-cancel');
    expect(body.access_token).toBeUndefined();
    expect(body.task_uuid).toBe('uuid-to-cancel');
    expect(body.cancellation_type).toBe(2);
    expect(body.description).toBe('Cliente canceló');
  });

  it('throws MuApiError on error response', async () => {
    global.fetch = mockFetch({ error: 'Not found' }, false, 404);

    await expect(
      muCancel({ accessToken: 'tok', taskUuid: 'bad-uuid', cancellationType: 1, description: '' })
    ).rejects.toBeInstanceOf(MuApiError);
  });
});

describe('muAddStore', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('sends correct payload', async () => {
    global.fetch = mockFetch({}, true, 200);

    await muAddStore({
      accessToken: 'tok-store',
      idPoint: 'store-001',
      name: 'KPU Cafe Principal',
      address: 'Calle 72 # 45-10',
      city: MU_CITY_IDS.Barranquilla,
      phone: '3001112222',
    });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${MU_BASE}/api/Add-store`);

    const body = JSON.parse(init.body as string);
    expect(body.access_token).toBe('tok-store');
    expect(body.id_point).toBe('store-001');
    expect(body.name).toBe('KPU Cafe Principal');
    expect(body.address).toBe('Calle 72 # 45-10');
    expect(body.city).toBe(4);
    expect(body.phone).toBe('3001112222');
  });
});

describe('muRegisterWebhook', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('sends correct payload', async () => {
    global.fetch = mockFetch({}, true, 200);

    await muRegisterWebhook({
      accessToken: 'tok-wh',
      endpoint: 'https://kpucafe.com/api/mu-webhook',
      tokenEndpoint: 'secret-token',
    });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${MU_BASE}/api/webhook`);

    const body = JSON.parse(init.body as string);
    expect(body.access_token).toBe('tok-wh');
    expect(body.endpoint).toBe('https://kpucafe.com/api/mu-webhook');
    expect(body.token_endpoint).toBe('secret-token');
  });
});

describe('MuApiError', () => {
  it('is an instance of Error', () => {
    const err = new MuApiError('test', 500);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(MuApiError);
    expect(err.message).toBe('test');
    expect(err.status).toBe(500);
    expect(err.name).toBe('MuApiError');
  });
});
