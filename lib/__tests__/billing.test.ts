import { describe, it, expect } from 'vitest';
import { computeNextBillingDate, mapEpaycoStatus } from '@/lib/billing';

describe('computeNextBillingDate', () => {
  it('adds 7 days for weekly', () => {
    const from = new Date('2026-04-21');
    const next = computeNextBillingDate(from, 'weekly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-04-28');
  });

  it('adds 14 days for biweekly', () => {
    const from = new Date('2026-04-21');
    const next = computeNextBillingDate(from, 'biweekly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-05-05');
  });

  it('adds 1 month for monthly', () => {
    const from = new Date('2026-04-21');
    const next = computeNextBillingDate(from, 'monthly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-05-21');
  });
});

describe('mapEpaycoStatus', () => {
  it('maps "Aceptada" to approved', () => {
    expect(mapEpaycoStatus('Aceptada')).toBe('approved');
  });
  it('maps "approved" to approved', () => {
    expect(mapEpaycoStatus('approved')).toBe('approved');
  });
  it('maps "Pendiente" to pending', () => {
    expect(mapEpaycoStatus('Pendiente')).toBe('pending');
  });
  it('maps "Rechazada" to rejected', () => {
    expect(mapEpaycoStatus('Rechazada')).toBe('rejected');
  });
  it('maps empty string to rejected', () => {
    expect(mapEpaycoStatus('')).toBe('rejected');
  });
});
