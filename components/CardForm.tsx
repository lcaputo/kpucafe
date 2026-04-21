'use client';

import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';

export interface CardFormValues {
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvc: string;
  cardHolder: string;
}

export interface CardTokenResult {
  tokenId: string;
  franchise: string;
  mask: string;
  expMonth: string;
  expYear: string;
  cardHolder: string;
}

interface CardFormProps {
  onSuccess: (result: CardTokenResult) => void;
  onError?: (msg: string) => void;
  submitLabel?: string;
  loading?: boolean;
  showSaveOption?: boolean;
  saveCard?: boolean;
  onSaveCardChange?: (val: boolean) => void;
}

function formatCardNumber(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

export default function CardForm({
  onSuccess,
  onError,
  submitLabel = 'Pagar',
  loading = false,
  showSaveOption = false,
  saveCard = false,
  onSaveCardChange,
}: CardFormProps) {
  const [values, setValues] = useState({ cardNumber: '', expiry: '', cvc: '', cardHolder: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tokenizing, setTokenizing] = useState(false);

  const inputClass = (field: string) =>
    `w-full px-4 py-3 rounded-xl border ${
      errors[field] ? 'border-destructive ring-2 ring-destructive/20' : 'border-border'
    } bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all`;

  const validate = () => {
    const e: Record<string, string> = {};
    const digits = values.cardNumber.replace(/\s/g, '');
    if (digits.length < 13) e.cardNumber = 'Número de tarjeta inválido';
    if (!values.cardHolder.trim()) e.cardHolder = 'Nombre requerido';
    const expParts = values.expiry.split('/');
    if (expParts.length !== 2 || expParts[0].length !== 2 || expParts[1].length !== 2) {
      e.expiry = 'Vencimiento inválido (MM/AA)';
    }
    if (values.cvc.length < 3) e.cvc = 'CVC inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setTokenizing(true);
    try {
      const [expMonth, expYear] = values.expiry.split('/');
      const res = await fetch('/api/payment-methods/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: values.cardNumber.replace(/\s/g, ''),
          expMonth,
          expYear,
          cvc: values.cvc,
          cardHolder: values.cardHolder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al procesar tarjeta');
      onSuccess({ ...data, expMonth, expYear: `20${expYear}`, cardHolder: values.cardHolder });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al tokenizar tarjeta';
      setErrors({ cardNumber: msg });
      onError?.(msg);
    } finally {
      setTokenizing(false);
    }
  };

  const busy = loading || tokenizing;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Número de tarjeta
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={values.cardNumber}
            onChange={e => setValues(v => ({ ...v, cardNumber: formatCardNumber(e.target.value) }))}
            placeholder="1234 5678 9012 3456"
            className={inputClass('cardNumber')}
            maxLength={19}
          />
          <CreditCard className="absolute right-3 top-3.5 h-5 w-5 text-muted-foreground pointer-events-none" />
        </div>
        {errors.cardNumber && <p className="text-xs text-destructive mt-1">{errors.cardNumber}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Nombre en la tarjeta
        </label>
        <input
          type="text"
          value={values.cardHolder}
          onChange={e => setValues(v => ({ ...v, cardHolder: e.target.value.toUpperCase() }))}
          placeholder="NOMBRE APELLIDO"
          className={inputClass('cardHolder')}
        />
        {errors.cardHolder && <p className="text-xs text-destructive mt-1">{errors.cardHolder}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Vence (MM/AA)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={values.expiry}
            onChange={e => setValues(v => ({ ...v, expiry: formatExpiry(e.target.value) }))}
            placeholder="MM/AA"
            className={inputClass('expiry')}
            maxLength={5}
          />
          {errors.expiry && <p className="text-xs text-destructive mt-1">{errors.expiry}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">CVC</label>
          <input
            type="text"
            inputMode="numeric"
            value={values.cvc}
            onChange={e => setValues(v => ({ ...v, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            placeholder="123"
            className={inputClass('cvc')}
            maxLength={4}
          />
          {errors.cvc && <p className="text-xs text-destructive mt-1">{errors.cvc}</p>}
        </div>
      </div>

      {showSaveOption && (
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={saveCard}
            onChange={e => onSaveCardChange?.(e.target.checked)}
            className="rounded border-border"
          />
          Guardar tarjeta para futuras compras
        </label>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full btn-kpu flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </button>
    </form>
  );
}
