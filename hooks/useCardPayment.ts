import { useState, useEffect, useCallback } from 'react';

export interface SavedPaymentMethod {
  id: string;
  franchise: string;
  mask: string;
  expMonth: string;
  expYear: string;
  cardHolder: string;
  isDefault: boolean;
}

export function useCardPayment() {
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);

  const fetchMethods = useCallback(async () => {
    setLoadingMethods(true);
    try {
      const res = await fetch('/api/payment-methods');
      if (res.ok) setSavedMethods(await res.json());
    } catch {
      // ignore — user may not be logged in
    } finally {
      setLoadingMethods(false);
    }
  }, []);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const saveCard = useCallback(async (token: {
    tokenId: string;
    franchise: string;
    mask: string;
    expMonth: string;
    expYear: string;
    cardHolder: string;
  }) => {
    const res = await fetch('/api/payment-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al guardar tarjeta');
    await fetchMethods();
    return data as SavedPaymentMethod;
  }, [fetchMethods]);

  const chargeSaved = useCallback(async (methodId: string, amount: number, orderId: string) => {
    const res = await fetch(`/api/payment-methods/${methodId}/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, orderId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al procesar pago');
    return data as { status: string; epaycoRef: string | null; message: string };
  }, []);

  const chargeNewCard = useCallback(async (card: {
    cardNumber: string;
    expMonth: string;
    expYear: string;
    cvc: string;
    cardHolder: string;
  }, amount: number, orderId: string) => {
    const res = await fetch('/api/payment-methods/charge-once', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...card, amount, orderId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al procesar pago');
    return data as { status: string; epaycoRef: string | null; franchise: string; mask: string };
  }, []);

  const deleteMethod = useCallback(async (id: string) => {
    await fetch(`/api/payment-methods/${id}`, { method: 'DELETE' });
    await fetchMethods();
  }, [fetchMethods]);

  const setDefault = useCallback(async (id: string) => {
    await fetch(`/api/payment-methods/${id}/default`, { method: 'PATCH' });
    await fetchMethods();
  }, [fetchMethods]);

  return {
    savedMethods,
    loadingMethods,
    fetchMethods,
    saveCard,
    chargeSaved,
    chargeNewCard,
    deleteMethod,
    setDefault,
  };
}
