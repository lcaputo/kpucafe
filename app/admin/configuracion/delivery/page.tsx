'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Save, Loader2, ExternalLink, ToggleLeft, ToggleRight, Package } from 'lucide-react';
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

interface EnviaConfig {
  city: string;
  provider: string;
  enabled: boolean;
  pickupAddress: string;
  pickupCity: string;
  pickupPhone: string;
  pickupStoreName: string;
  enviaApiToken: string;
  enviaCarriers: string[];
  enviaPickupStart: string;
  enviaPickupEnd: string;
  defaultWeight: number;
  defaultLength: number;
  defaultWidth: number;
  defaultHeight: number;
}

const DEFAULT_ENVIA: EnviaConfig = {
  city: '__national__',
  provider: 'envia',
  enabled: false,
  pickupAddress: '',
  pickupCity: '',
  pickupPhone: '',
  pickupStoreName: '',
  enviaApiToken: '',
  enviaCarriers: ['coordinadora', 'deprisa'],
  enviaPickupStart: '09:00',
  enviaPickupEnd: '17:00',
  defaultWeight: 0.5,
  defaultLength: 20,
  defaultWidth: 15,
  defaultHeight: 10,
};

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none';

export default function AdminDeliveryConfigPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<DeliveryConfig>(DEFAULT_CONFIG);
  const [enviaConfig, setEnviaConfig] = useState<EnviaConfig>(DEFAULT_ENVIA);
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

          // Also check for Envia settings
          const enviaSettings = data.find((s: any) => s.provider === 'envia');
          if (enviaSettings) {
            setEnviaConfig({
              city: enviaSettings.city,
              provider: 'envia',
              enabled: enviaSettings.enabled,
              pickupAddress: enviaSettings.pickupAddress,
              pickupCity: enviaSettings.pickupCity,
              pickupPhone: enviaSettings.pickupPhone,
              pickupStoreName: enviaSettings.pickupStoreName || '',
              enviaApiToken: enviaSettings.enviaApiToken || '',
              enviaCarriers: enviaSettings.enviaCarriers || ['coordinadora', 'deprisa'],
              enviaPickupStart: enviaSettings.enviaPickupStart || '09:00',
              enviaPickupEnd: enviaSettings.enviaPickupEnd || '17:00',
              defaultWeight: enviaSettings.defaultWeight || 0.5,
              defaultLength: enviaSettings.defaultLength || 20,
              defaultWidth: enviaSettings.defaultWidth || 15,
              defaultHeight: enviaSettings.defaultHeight || 10,
            });
          }
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

  const handleSaveEnvia = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/delivery-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...enviaConfig,
          pickupStoreId: '',
          muAccessToken: '',
          muWebhookToken: '',
          timeSlots: [],
          availableDays: 7,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast({ title: 'Configuracion Envia guardada' });
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

      {/* Separator */}
      <div className="border-t border-border my-8" />

      {/* Envia.com Section */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Package className="h-6 w-6 text-green-600" />
          Envia.com — Envios Nacionales
        </h2>
        <button
          onClick={() => setEnviaConfig((c) => ({ ...c, enabled: !c.enabled }))}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${enviaConfig.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
        >
          {enviaConfig.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
          {enviaConfig.enabled ? 'Activo' : 'Desactivado'}
        </button>
      </div>

      {/* Envia API Token */}
      <div className="bg-card rounded-xl p-6 shadow-soft space-y-4">
        <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" />
          Credenciales Envia
        </h3>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            API Token de Envia
          </label>
          <input
            type="password"
            value={enviaConfig.enviaApiToken}
            onChange={e => setEnviaConfig(c => ({ ...c, enviaApiToken: e.target.value }))}
            placeholder="Token de acceso de Envia.com"
            className={INPUT_CLASS}
            autoComplete="new-password"
          />
        </div>
      </div>

      {/* Envia Carriers */}
      <div className="bg-card rounded-xl p-6 shadow-soft space-y-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Transportadoras
        </h3>
        <div className="flex items-center gap-6">
          {(['coordinadora', 'deprisa'] as const).map(carrier => (
            <label key={carrier} className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={enviaConfig.enviaCarriers.includes(carrier)}
                onChange={e => {
                  setEnviaConfig(c => ({
                    ...c,
                    enviaCarriers: e.target.checked
                      ? [...c.enviaCarriers, carrier]
                      : c.enviaCarriers.filter(x => x !== carrier),
                  }));
                }}
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              {carrier.charAt(0).toUpperCase() + carrier.slice(1)}
            </label>
          ))}
        </div>
      </div>

      {/* Envia Pickup Address */}
      <div className="bg-card rounded-xl p-6 shadow-soft space-y-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Punto de Recoleccion
        </h3>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Nombre del punto
          </label>
          <input
            type="text"
            value={enviaConfig.pickupStoreName}
            onChange={e => setEnviaConfig(c => ({ ...c, pickupStoreName: e.target.value }))}
            placeholder="Ej: KPU Cafe"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Direccion de recoleccion
          </label>
          <input
            type="text"
            value={enviaConfig.pickupAddress}
            onChange={e => setEnviaConfig(c => ({ ...c, pickupAddress: e.target.value }))}
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
              value={enviaConfig.pickupCity}
              onChange={e => setEnviaConfig(c => ({ ...c, pickupCity: e.target.value }))}
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
              value={enviaConfig.pickupPhone}
              onChange={e => setEnviaConfig(c => ({ ...c, pickupPhone: e.target.value }))}
              placeholder="Ej: 3001234567"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      {/* Envia Pickup Window */}
      <div className="bg-card rounded-xl p-6 shadow-soft space-y-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Ventana de Recoleccion
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Hora de inicio
            </label>
            <input
              type="time"
              value={enviaConfig.enviaPickupStart}
              onChange={e => setEnviaConfig(c => ({ ...c, enviaPickupStart: e.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Hora de fin
            </label>
            <input
              type="time"
              value={enviaConfig.enviaPickupEnd}
              onChange={e => setEnviaConfig(c => ({ ...c, enviaPickupEnd: e.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      {/* Envia Package Fallback */}
      <div className="bg-card rounded-xl p-6 shadow-soft space-y-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Dimensiones por Defecto del Paquete
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Peso (kg)
            </label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={enviaConfig.defaultWeight}
              onChange={e => setEnviaConfig(c => ({ ...c, defaultWeight: Number(e.target.value) }))}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Largo (cm)
            </label>
            <input
              type="number"
              min={0}
              value={enviaConfig.defaultLength}
              onChange={e => setEnviaConfig(c => ({ ...c, defaultLength: Number(e.target.value) }))}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Ancho (cm)
            </label>
            <input
              type="number"
              min={0}
              value={enviaConfig.defaultWidth}
              onChange={e => setEnviaConfig(c => ({ ...c, defaultWidth: Number(e.target.value) }))}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Alto (cm)
            </label>
            <input
              type="number"
              min={0}
              value={enviaConfig.defaultHeight}
              onChange={e => setEnviaConfig(c => ({ ...c, defaultHeight: Number(e.target.value) }))}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      {/* Save Envia */}
      <div className="flex justify-end pb-4">
        <button
          onClick={handleSaveEnvia}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Save className="h-4 w-4" />}
          Guardar configuracion Envia
        </button>
      </div>

    </div>
  );
}
