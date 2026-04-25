// Delivery configuration read from environment variables.
// Replaces database-backed DeliverySettings queries.

export interface TimeSlot {
  label: string;
  start: string;
  end: string;
}

export interface MuConfig {
  enabled: boolean;
  accessToken: string;
  webhookToken: string;
  city: string;
  pickupAddress: string;
  pickupCity: string;
  pickupStoreId: string;
  pickupStoreName: string;
  pickupPhone: string;
  timeSlots: TimeSlot[];
  availableDays: number;
}

export interface EnviaConfig {
  enabled: boolean;
  apiToken: string;
  carriers: string[];
  pickupAddress: string;
  pickupCity: string;
  pickupPhone: string;
  pickupStoreName: string;
  pickupStart: string;
  pickupEnd: string;
  defaultWeight: number;
  defaultLength: number;
  defaultWidth: number;
  defaultHeight: number;
}

export function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { label: "9:00 - 12:00", start: "09:00", end: "12:00" },
  { label: "12:00 - 15:00", start: "12:00", end: "15:00" },
  { label: "15:00 - 18:00", start: "15:00", end: "18:00" },
];

const DEFAULT_CARRIERS = ["coordinadora", "deprisa"];

export function getMuConfig(): MuConfig {
  return {
    enabled: process.env.MU_ENABLED === "true",
    accessToken: process.env.MU_ACCESS_TOKEN ?? "",
    webhookToken: process.env.MU_WEBHOOK_TOKEN ?? "",
    city: process.env.MU_CITY ?? "Barranquilla",
    pickupAddress: process.env.MU_PICKUP_ADDRESS ?? "",
    pickupCity: process.env.MU_PICKUP_CITY ?? "Barranquilla",
    pickupStoreId: process.env.MU_PICKUP_STORE_ID ?? "",
    pickupStoreName: process.env.MU_PICKUP_STORE_NAME ?? "KPU Cafe",
    pickupPhone: process.env.MU_PICKUP_PHONE ?? "",
    timeSlots: parseJson<TimeSlot[]>(process.env.MU_TIME_SLOTS, DEFAULT_TIME_SLOTS),
    availableDays: parseInt(process.env.MU_AVAILABLE_DAYS ?? "7", 10),
  };
}

export function getEnviaConfig(): EnviaConfig {
  return {
    enabled: process.env.ENVIA_ENABLED === "true",
    apiToken: process.env.ENVIA_API_TOKEN ?? "",
    carriers: parseJson<string[]>(process.env.ENVIA_CARRIERS, DEFAULT_CARRIERS),
    pickupAddress: process.env.ENVIA_PICKUP_ADDRESS ?? "",
    pickupCity: process.env.ENVIA_PICKUP_CITY ?? "",
    pickupPhone: process.env.ENVIA_PICKUP_PHONE ?? "",
    pickupStoreName: process.env.ENVIA_PICKUP_STORE_NAME ?? "KPU Cafe",
    pickupStart: process.env.ENVIA_PICKUP_START ?? "09:00",
    pickupEnd: process.env.ENVIA_PICKUP_END ?? "17:00",
    defaultWeight: parseFloat(process.env.ENVIA_DEFAULT_WEIGHT ?? "0.5"),
    defaultLength: parseFloat(process.env.ENVIA_DEFAULT_LENGTH ?? "20"),
    defaultWidth: parseFloat(process.env.ENVIA_DEFAULT_WIDTH ?? "15"),
    defaultHeight: parseFloat(process.env.ENVIA_DEFAULT_HEIGHT ?? "10"),
  };
}
