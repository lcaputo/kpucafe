import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  muCalculate,
  muCreateService,
  muTrack,
  muCancel,
  muAddStore,
  muRegisterWebhook,
  MU_CITY_IDS,
} from '../mensajeros-urbanos';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('MU_CITY_IDS', () => {
  it('maps Barranquilla to 4', () => {
    expect(MU_CITY_IDS.Barranquilla).toBe(4);
  });
});

describe('muCalculate', () => {
  it('calls MU /api/calculate with address strings and returns mapped result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        total_service: 8500,
        total_distance: '5.2 km',
        base_value: 6000,
        distance_surcharge: 2000,
        insurance_surcharge: 500,
      }),
    });

    const result = await muCalculate({
      accessToken: 'test-token',
      cityId: 4,
      declaredValue: 50000,
      originAddress: 'Calle 72 #55-30, Barranquilla',
      destinationAddress: 'Calle 84 #42-15, Barranquilla',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://mu-integraciones.mensajerosurbanos.com/api/calculate');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.access_token).toBe('test-token');
    expect(body.type_service).toBe(4);
    expect(body.city).toBe(4);
    expect(body.declared_value).toBe(50000);
    expect(body.coordinates).toHaveLength(2);
    expect(body.coordinates[0].address).toBe('Calle 72 #55-30, Barranquilla');
    expect(body.coordinates[1].address).toBe('Calle 84 #42-15, Barranquilla');

    expect(result.totalService).toBe(8500);
    expect(result.totalDistance).toBe('5.2 km');
  });

  it('throws on MU API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid token' }),
    });

    await expect(muCalculate({
      accessToken: 'bad-token',
      cityId: 4,
      declaredValue: 50000,
      originAddress: 'origin',
      destinationAddress: 'dest',
    })).rejects.toThrow('MU API error');
  });
});

describe('muCreateService', () => {
  it('calls MU /api/create and returns uuid + taskId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        task_id: 12345,
        uuid: 'abc-def-123',
        status: 2,
        total: 8500,
        distance: '5.2',
      }),
    });

    const result = await muCreateService({
      accessToken: 'test-token',
      cityId: 4,
      declaredValue: 50000,
      startDate: '2026-04-22',
      startTime: '09:00:00',
      storeId: 'kpu-baq-01',
      destination: {
        address: 'Calle 84 #42-15',
        orderId: 'order-123',
        description: 'Apto 301',
        clientName: 'Juan Perez',
        clientPhone: '3001234567',
        clientEmail: 'juan@test.com',
        paymentType: '3',
        productsValue: 50000,
        domicileValue: '8500',
      },
      products: [
        { storeId: 'kpu-baq-01', productName: 'Cafe Origen', quantity: 2, value: 25000 },
      ],
      observation: 'Cafe especial, fragil',
    });

    expect(result.uuid).toBe('abc-def-123');
    expect(result.taskId).toBe(12345);
    expect(result.total).toBe(8500);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.coordinates[0].client_data.client_name).toBe('Juan Perez');
    expect(body.coordinates[0].products[0].store_id).toBe('kpu-baq-01');
  });
});

describe('muTrack', () => {
  it('returns structured data with driver info', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { task_id: 12345, status_id: 3, status: 'assigned' },
        resource: { name: 'Carlos', phone: '3009876543', plate_number: 'ABC123', type_resource_name: 'Motocicleta', photo: 'https://photo.url' },
        address: [{ address: 'Calle 84', status: 0 }],
        history: [{ status_id: 2, status: 'on_hold', date: '2026-04-21' }],
      }),
    });

    const result = await muTrack({ accessToken: 'test-token', uuid: 'abc-def-123' });

    expect(result.statusId).toBe(3);
    expect(result.statusName).toBe('assigned');
    expect(result.driver?.name).toBe('Carlos');
    expect(result.driver?.phone).toBe('3009876543');
    expect(result.driver?.plate).toBe('ABC123');
  });
});

describe('muCancel', () => {
  it('uses the acces_token typo field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Cancelled' }),
    });

    await muCancel({
      accessToken: 'test-token',
      uuid: 'abc-def-123',
      cancellationType: 3,
      description: 'Cliente cancelo',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.acces_token).toBe('test-token');
    expect(body.access_token).toBeUndefined();
    expect(body.task_uuid).toBe('abc-def-123');
  });
});

describe('muAddStore', () => {
  it('calls /api/Add-store with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 999 }),
    });

    await muAddStore({
      accessToken: 'test-token',
      idPoint: 'kpu-baq-01',
      name: 'KPU Cafe Barranquilla',
      address: 'Calle 72 #55-30',
      city: 'Barranquilla',
      phone: '3001112233',
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://mu-integraciones.mensajerosurbanos.com/api/Add-store');
    const body = JSON.parse(options.body);
    expect(body.id_point).toBe('kpu-baq-01');
  });
});

describe('muRegisterWebhook', () => {
  it('calls /api/webhook with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'OK' }),
    });

    await muRegisterWebhook({
      accessToken: 'test-token',
      endpoint: 'https://kpucafe.com/api/delivery/mu-webhook',
      tokenEndpoint: 'my-secret',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.token_endpoint).toBe('my-secret');
  });
});
