'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Save, Loader2, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TimeSlot {
  label: string;
  start: string;
  end: string;
}

interface DeliveryConfig {
  city: string;
  enabled: boolean;
  muAccessToken: string;
  muWebhookToken: string;
  pickupAddress: string;
  pickupCity: string;
  pickupStoreId: string;
  pickupStoreName: string;
  pickupPhone: string;
  timeSlots: TimeSlot[];
  availableDays: number;
}

const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { label: '9:00 - 12:00',   start: '09:00', end: '12:00' },
  { label: '12:00 - 15:00',  start: '12:00', end: '15:00' },
  { label: '15:00 - 18:00',  start: '15:00', end: '18:00' },
];

const DEFAULT_CONFIG: DeliveryConfig = {
  city: 'Barranquilla',
  enabled: false,
  muAccessToken: '',
  muWebhookToken: '',
  pickupAddress: '',
  pickupCity: 'Barranquilla',
  pickupStoreId: '',
  pickupStoreName: '',
  pickupPhone: '',
  timeSlots: DEFAULT_TIME_SLOTS,
  availableDays: 7,
};

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none';

export default function AdminDeliveryConfigPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<DeliveryConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/delivery-settings');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const item = data[0];
          setConfig({
            city:             item.city             ?? DEFAULT_CONFIG.city,
            enabled:          item.enabled          ?? false,
            muAccessToken:    item.muAccessToken    ?? '',
            muWebhookToken:   item.muWebhookToken   ?? '',
            pickupAddress:    item.pickupAddress    ?? '',
            pickupCity:       item.pickupCity       ?? DEFAULT_CONFIG.pickupCity,
            pickupStoreId:    item.pickupStoreId    ?? '',
            pickupStoreName:  item.pickupStoreName  ?? '',
            pickupPhone:      item.pickupPhone      ?? '',
            timeSlots:        Array.isArray(item.timeSlots) && item.timeSlots.length > 0
                                ? item.timeSlots
                                : DEFAULT_TIME_SLOTS,
            availableDays:    item.availableDays    ?? 7,
          });
        }
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const set = <K extends keyof DeliveryConfig>(key: K, value: DeliveryConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/delivery-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Error al guardar'); }
      toast({ title: 'Configuracion guardada' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleRegisterStore = async () => {
    setRegistering(true);
    try {
      const res = await fetch('/api/admin/delivery-settings/register-store', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? 'Error al registrar');
      toast({ title: 'Punto registrado en MU', description: d.message });
    } catch (err: any) {
      toast({ title: 'Error al registrar', description: err.message, variant: 'destructive' });
    }
    setRegistering(false);
  };

  // Time slot helpers
  const addSlot = () =>
    set('timeSlots', [...config.timeSlots, { label: '', start: '', end: '' }]);

  const removeSlot = (index: number) =>
    set('timeSlots', config.timeSlots.filter((_, i) => i !== index));

  const updateSlot = (index: number, field: keyof TimeSlot, value: string) => {
    const updated = config.timeSlots.map((slot, i) =>
      i === index ? { ...slot, [field]: value } : slot
    );
    set('timeSlots', updated);
  };

  const handleStoreIdChange = (value: string) => {
    // alphanumeric + dash only, max 20 chars
    const sanitized = value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20);
    set('pickupStoreId', sanitized);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="bg-card rounded-xl p-6 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary flex-shrink-0" />
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                Mensajeros Urbanos
              </h2>
              <p className="text-sm text-muted-foreground">
                Configuracion de envios a domicilio
              </p>
            </div>
          </div>
          <button
            onClick={() => set('enabled', !config.enabled)}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            aria-label={config.enabled ? 'Desactivar MU' : 'Activar MU'}
          >
            {config.enabled ? (
              <>
                <ToggleRight className="h-7 w-7 text-primary" />
                <span className="text-primary">Activo</span>
              </>
            ) : (
              <>
                <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                <span className="text-muted-foreground">Inactivo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Credentials */}
      <div className="bg-card rounded-xl p-6 shadow-soft space-y-4">
        <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" />
          Credenciales
        </h3>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Access Token de MU
          </label>
          <input
            type="password"
            value={config.muAccessToken}
            onChange={e => set('muAccessToken', e.target.value)}
            placeholder="Token de acceso de Mensajeros Urbanos"
            className={INPUT_CLASS}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Webhook Token de MU
          </label>
          <input
            type="password"
            value={config.muWebhookToken}
            onChange={e => set('muWebhookToken', e.target.value)}
            placeholder="Token para verificar webhooks de MU"
            className={INPUT_CLASS}
            autoComplete="new-password"
          />
        </div>
      </div>

      {/* Pickup Point */}
      <div className="bg-card rounded-xl p-6 shadow-soft space-y-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Punto de Recoleccion
        </h3>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Nombre del punto
            </label>
            <input
              type="text"
              value={config.pickupStoreName}
              onChange={e => set('pickupStoreName', e.target.value)}
              placeholder="Ej: KPU Cafe Barranquilla"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              ID del punto{' '}
              <span className="text-muted-foreground font-normal text-xs">(max 20 chars, letras, numeros y guion)</span>
            </label>
            <input
              type="text"
              value={config.pickupStoreId}
              onChange={e => handleStoreIdChange(e.target.value)}
              placeholder="Ej: kpu-cafe-baq"
              maxLength={20}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Direccion de recoleccion
          </label>
          <input
            type="text"
            value={config.pickupAddress}
            onChange={e => set('pickupAddress', e.target.value)}
            placeholder="Ej: Calle 72 #53-43"
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Ciudad de recoleccion
            </label>
            <input
              type="text"
              value={config.pickupCity}
              onChange={e => set('pickupCity', e.target.value)}
              placeholder="Ej: Barranquilla"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Telefono del punto
            </label>
            <input
              type="tel"
              value={config.pickupPhone}
              onChange={e => set('pickupPhone', e.target.value)}
              placeholder="Ej: 3001234567"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleRegisterStore}
            disabled={registering}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {registering
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ExternalLink className="h-4 w-4" />}
            Registrar punto en MU
          </button>
        </div>
      </div>

      {/* Time Slots */}
      <div className="bg-card rounded-xl p-6 shadow-soft space-y-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Franjas Horarias
        </h3>

        <div className="space-y-3">
          {config.timeSlots.map((slot, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={slot.label}
                  onChange={e => updateSlot(index, 'label', e.target.value)}
                  placeholder="Etiqueta"
                  className={INPUT_CLASS}
                />
                <input
                  type="time"
                  value={slot.start}
                  onChange={e => updateSlot(index, 'start', e.target.value)}
                  className={INPUT_CLASS}
                />
                <input
                  type="time"
                  value={slot.end}
                  onChange={e => updateSlot(index, 'end', e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <button
                onClick={() => removeSlot(index)}
                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                aria-label="Eliminar franja"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {config.timeSlots.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay franjas horarias configuradas.
          </p>
        )}

        <button
          onClick={addSlot}
          className="inline-flex items-center gap-2 px-4 py-2 border border-input text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
        >
          <Plus className="h-4 w-4" />
          Agregar franja
        </button>

        <div className="pt-2 border-t border-border">
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Dias disponibles para agendar{' '}
            <span className="text-muted-foreground font-normal text-xs">(1 - 14)</span>
          </label>
          <input
            type="number"
            min={1}
            max={14}
            value={config.availableDays}
            onChange={e => set('availableDays', Math.min(14, Math.max(1, Number(e.target.value))))}
            className="w-28 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end pb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Save className="h-4 w-4" />}
          Guardar configuracion
        </button>
      </div>

    </div>
  );
}
