export type PriceHistoryPoint = {
  timestamp: string;
  price: number;
};

export type PriceHistoryRange = "1D" | "1W" | "1M" | "1Y" | "ALL";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEMO_HISTORY_END_MS = Date.UTC(2026, 4, 10, 0, 0, 0);

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const clampPrice = (price: number, basePrice: number) =>
  Math.max(0.0001, Math.min(basePrice * 2.4, Math.max(basePrice * 0.22, price)));

const roundPrice = (value: number) => Number(value.toFixed(value >= 100 ? 2 : 4));

const priceAt = ({
  basePrice,
  hash,
  timestamp,
}: {
  basePrice: number;
  hash: number;
  timestamp: number;
}) => {
  const t = Math.max(0, Math.min(1, (timestamp - (DEMO_HISTORY_END_MS - 730 * DAY_MS)) / (730 * DAY_MS)));
  const phase = (hash % 360) * (Math.PI / 180);
  const trendStrength = 0.28 + ((hash >> 4) % 18) / 100;
  const trend = 0.76 + t * trendStrength;
  const longWave = Math.sin(t * Math.PI * (3.2 + (hash % 4)) + phase) * 0.09;
  const midWave = Math.sin(t * Math.PI * (13 + (hash % 7)) + phase * 0.7) * 0.045;
  const recentWave = Math.sin(t * Math.PI * 52 + phase * 1.7) * 0.018;
  const eventCenter = 0.58 + ((hash % 19) - 9) / 100;
  const eventWidth = 0.012 + (hash % 5) / 500;
  const eventDirection = hash % 2 === 0 ? 1 : -1;
  const event = Math.exp(-Math.pow((t - eventCenter) / eventWidth, 2)) * 0.08 * eventDirection;

  return clampPrice(basePrice * (trend + longWave + midWave + recentWave + event), basePrice);
};

export const createMockPriceHistory = ({
  basePrice,
  key,
}: {
  basePrice: number;
  key: string;
}): PriceHistoryPoint[] => {
  const safeBase = Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 1;
  const hash = hashString(key);
  const timestamps: number[] = [];

  for (let day = 730; day >= 8; day -= 1) {
    timestamps.push(DEMO_HISTORY_END_MS - day * DAY_MS);
  }

  for (let hour = 7 * 24; hour >= 0; hour -= 1) {
    timestamps.push(DEMO_HISTORY_END_MS - hour * HOUR_MS);
  }

  const raw = timestamps.map((timestamp) => ({
    timestamp,
    price: priceAt({ basePrice: safeBase, hash, timestamp }),
  }));
  const lastPrice = raw[raw.length - 1]?.price || safeBase;
  const normalize = safeBase / lastPrice;

  return raw.map((point) => ({
    timestamp: new Date(point.timestamp).toISOString(),
    price: roundPrice(clampPrice(point.price * normalize, safeBase)),
  }));
};

export const parseAtomicSpumpToNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return numeric / 1_000_000_000;
};
