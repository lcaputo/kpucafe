import { addDays, addMonths } from 'date-fns';

export type SubscriptionFrequency = 'weekly' | 'biweekly' | 'monthly';
export type EpaycoChargeStatus = 'approved' | 'rejected' | 'pending';

export function computeNextBillingDate(
  from: Date,
  frequency: SubscriptionFrequency,
): Date {
  switch (frequency) {
    case 'weekly':   return addDays(from, 7);
    case 'biweekly': return addDays(from, 14);
    case 'monthly':  return addMonths(from, 1);
  }
}

export function mapEpaycoStatus(estado: string): EpaycoChargeStatus {
  const lower = estado.toLowerCase();
  if (['aceptada', 'approved', 'aprobada'].includes(lower)) return 'approved';
  if (['pendiente', 'pending'].includes(lower)) return 'pending';
  return 'rejected';
}
