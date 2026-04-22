import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enviaRate,
  enviaGenerate,
  enviaTrack,
  enviaPickup,
  enviaCancel,
  enviaRegisterWebhook,
  EnviaApiError,
} from '../envia';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.resetAllMocks();
});

// Shared test fixtures
const origin = {
  name: 'KPU Cafe',
  phone: '3001234567',
  street: 'Calle 72 #55-30',
  city: 'Barranquilla',
  state: 'Atlantico',
  country: 'CO',
  postalCode: '080001',
};

const destination = {
  name: 'Juan Perez',
  phone: '3009876543',
  street: 'Calle 84 #42-15',
  city: 'Bogota',
  state: 'Cundinamarca',
  country: 'CO',
  postalCode: '110111',
};

const packages = [
  {
    content: 'Cafe especialidad 500g',
    weight: 0.5,
    length: 20,
    width: 15,
    height: 10,
    declaredValue: 50000,
  },
];

const rateParams = {
  apiToken: 'test-api-token',
  carrier: 'fedex',
  origin,
  destination,
  packages,
};

describe('enviaRate', () => {
  it('sends correct payload and returns mapped result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meta: 'ok',
        data: [
          {
            carrier: 'fedex',
            service: 'FEDEX_GROUND',
            serviceDescription: 'FedEx Ground',
            deliveryEstimate: '3 días hábiles',
            totalPrice: '18500',
            currency: 'COP',
          },
        ],
      }),
    });

    const result = await enviaRate(rateParams);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.envia.com/ship/rate/');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer test-api-token');

    const body = JSON.parse(options.body);
    expect(body.shipment.carrier).toBe('fedex');
    expect(body.shipment.type).toBe(1);
    expect(body.settings.currency).toBe('COP');
    expect(body.packages[0].type).toBe('box');
    expect(body.packages[0].amount).toBe(1);
    expect(body.packages[0].lengthUnit).toBe('CM');
    expect(body.packages[0].weightUnit).toBe('KG');
    expect(body.packages[0].additionalServices).toContain('envia_insurance');
    expect(body.origin.name).toBe('KPU Cafe');
    expect(body.destination.name).toBe('Juan Perez');

    expect(result.carrier).toBe('fedex');
    expect(result.service).toBe('FEDEX_GROUND');
    expect(result.serviceDescription).toBe('FedEx Ground');
    expect(result.deliveryEstimate).toBe('3 días hábiles');
    expect(result.totalPrice).toBe(18500);
    expect(typeof result.totalPrice).toBe('number');
    expect(result.currency).toBe('COP');
  });

  it('throws EnviaApiError when meta is "error"', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        meta: 'error',
        message: 'Carrier not available for this route',
      }),
    });

    await expect(enviaRate(rateParams)).rejects.toThrow('Envia API error');
  });

  it('throws EnviaApiError instance when meta is "error" even with ok: true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        meta: 'error',
        message: 'Token inválido',
      }),
    });

    await expect(enviaRate({ ...rateParams, apiToken: 'bad-token' })).rejects.toBeInstanceOf(EnviaApiError);
  });
});

describe('enviaGenerate', () => {
  it('returns shipmentId, trackingNumber, labelUrl, and trackUrl', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meta: 'ok',
        data: [
          {
            shipmentId: 98765,
            trackingNumber: 'FX123456789CO',
            trackUrl: 'https://track.envia.com/FX123456789CO',
            labelUrl: 'https://labels.envia.com/98765.pdf',
            totalPrice: '18500',
            carrier: 'fedex',
            service: 'FEDEX_GROUND',
          },
        ],
      }),
    });

    const result = await enviaGenerate({
      ...rateParams,
      service: 'FEDEX_GROUND',
      orderReference: 'ORDER-001',
    });

    expect(result.shipmentId).toBe(98765);
    expect(result.trackingNumber).toBe('FX123456789CO');
    expect(result.trackUrl).toBe('https://track.envia.com/FX123456789CO');
    expect(result.labelUrl).toBe('https://labels.envia.com/98765.pdf');
    expect(result.totalPrice).toBe(18500);
    expect(result.carrier).toBe('fedex');
    expect(result.service).toBe('FEDEX_GROUND');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.shipment.service).toBe('FEDEX_GROUND');
    expect(body.shipment.orderReference).toBe('ORDER-001');
    expect(body.settings.printFormat).toBe('PDF');
    expect(body.settings.printSize).toBe('PAPER_4X6');
  });
});

describe('enviaTrack', () => {
  it('returns status and events array for each tracking number', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meta: 'ok',
        data: [
          {
            trackingNumber: 'FX123456789CO',
            status: 'in_transit',
            carrier: 'fedex',
            events: [
              {
                timestamp: '2026-04-21T10:00:00Z',
                description: 'Paquete recibido en centro de distribución',
                location: 'Barranquilla, CO',
              },
              {
                timestamp: '2026-04-21T14:00:00Z',
                description: 'En tránsito hacia destino',
              },
            ],
          },
        ],
      }),
    });

    const result = await enviaTrack({
      apiToken: 'test-api-token',
      trackingNumbers: ['FX123456789CO'],
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.envia.com/ship/generaltrack/');
    const body = JSON.parse(options.body);
    expect(body.trackingNumbers).toEqual(['FX123456789CO']);

    expect(result).toHaveLength(1);
    expect(result[0].trackingNumber).toBe('FX123456789CO');
    expect(result[0].status).toBe('in_transit');
    expect(result[0].carrier).toBe('fedex');
    expect(result[0].events).toHaveLength(2);
    expect(result[0].events[0].timestamp).toBe('2026-04-21T10:00:00Z');
    expect(result[0].events[0].description).toBe('Paquete recibido en centro de distribución');
    expect(result[0].events[0].location).toBe('Barranquilla, CO');
    expect(result[0].events[1].location).toBeUndefined();
  });
});

describe('enviaPickup', () => {
  it('sends correct payload to /ship/pickup/', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ meta: 'ok', data: { pickupId: 555 } }),
    });

    await enviaPickup({
      apiToken: 'test-api-token',
      carrier: 'fedex',
      pickupDate: '2026-04-22',
      pickupTimeStart: '09:00',
      pickupTimeEnd: '12:00',
      pickupAddress: origin,
      trackingNumbers: ['FX123456789CO', 'FX987654321CO'],
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.envia.com/ship/pickup/');
    expect(options.headers['Authorization']).toBe('Bearer test-api-token');

    const body = JSON.parse(options.body);
    expect(body.carrier).toBe('fedex');
    expect(body.pickupDate).toBe('2026-04-22');
    expect(body.pickupTimeStart).toBe('09:00');
    expect(body.pickupTimeEnd).toBe('12:00');
    expect(body.pickupAddress.name).toBe('KPU Cafe');
    expect(body.trackingNumbers).toEqual(['FX123456789CO', 'FX987654321CO']);
  });
});

describe('enviaCancel', () => {
  it('sends carrier and trackingNumber to /ship/cancel/', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ meta: 'ok', data: { cancelled: true } }),
    });

    await enviaCancel({
      apiToken: 'test-api-token',
      carrier: 'fedex',
      trackingNumber: 'FX123456789CO',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.envia.com/ship/cancel/');
    expect(options.headers['Authorization']).toBe('Bearer test-api-token');

    const body = JSON.parse(options.body);
    expect(body.carrier).toBe('fedex');
    expect(body.trackingNumber).toBe('FX123456789CO');
  });
});

describe('enviaRegisterWebhook', () => {
  it('sends correct payload to queries.envia.com/webhooks with default typeId 3', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ meta: 'ok', data: { id: 42 } }),
    });

    await enviaRegisterWebhook({
      apiToken: 'test-api-token',
      url: 'https://kpucafe.com/api/shipping/envia-webhook',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://queries.envia.com/webhooks');
    expect(options.headers['Authorization']).toBe('Bearer test-api-token');

    const body = JSON.parse(options.body);
    expect(body.type_id).toBe(3);
    expect(body.url).toBe('https://kpucafe.com/api/shipping/envia-webhook');
    expect(body.active).toBe(1);
  });

  it('uses custom typeId when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ meta: 'ok', data: { id: 43 } }),
    });

    await enviaRegisterWebhook({
      apiToken: 'test-api-token',
      url: 'https://kpucafe.com/api/shipping/envia-webhook',
      typeId: 7,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type_id).toBe(7);
  });
});
