import { CONFIG, SYMBOL_MAP } from '../config';
import type { AssetSymbol, Candle, TimeInterval } from '../domain/types';
import { broadcastPriceUpdate, broadcastCandleUpdate, hasCandleSubscribers } from '../ws/broadcaster';

// ── Price cache ──
const currentPrices = new Map<AssetSymbol, number>();
const priceUpdatedAt = new Map<AssetSymbol, number>();
const candleCache = new Map<string, { data: Candle[]; fetchedAt: number }>();
const PRICE_STALE_MS = 15_000; // 15 seconds

let pollingTimer: ReturnType<typeof setInterval> | null = null;

// ── Public API ──

export function getCurrentPrice(asset: AssetSymbol): number | undefined {
  const updatedAt = priceUpdatedAt.get(asset);
  if (updatedAt && Date.now() - updatedAt > PRICE_STALE_MS) {
    return undefined; // stale price — reject trades
  }
  return currentPrices.get(asset);
}

export function getAllPrices(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of currentPrices) out[k] = v;
  return out;
}

export async function fetchCandles(
  asset: AssetSymbol,
  interval: TimeInterval = '1m',
  limit: number = 300,
): Promise<Candle[]> {
  const symbol = SYMBOL_MAP[asset];
  if (!symbol) return [];

  const cacheKey = `${symbol}_${interval}_${limit}`;
  const cached = candleCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CONFIG.CANDLE_CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${CONFIG.BINANCE_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);

  const raw: unknown[][] = await res.json();
  const candles: Candle[] = raw.map((k) => ({
    time: Math.floor((k[0] as number) / 1000),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));

  candleCache.set(cacheKey, { data: candles, fetchedAt: Date.now() });
  return candles;
}

// ── Polling ──

async function pollPrices(): Promise<void> {
  const assets = CONFIG.VALID_ASSETS;
  const symbols = assets.map((a) => SYMBOL_MAP[a]).filter(Boolean);

  try {
    // Batch fetch all prices
    const url = `${CONFIG.BINANCE_BASE}/ticker/price?symbols=${JSON.stringify(symbols)}`;
    const res = await fetch(url);
    if (!res.ok) return;

    const data: { symbol: string; price: string }[] = await res.json();
    const symbolToAsset = new Map<string, AssetSymbol>();
    for (const a of assets) symbolToAsset.set(SYMBOL_MAP[a], a);

    for (const item of data) {
      const asset = symbolToAsset.get(item.symbol);
      if (!asset) continue;
      const price = parseFloat(item.price);
      currentPrices.set(asset, price);
      broadcastPriceUpdate(asset, price);
    }
  } catch (err) {
    console.error('[priceService] Poll error:', err);
  }
}

// ── Lifecycle callbacks (called by services that need price ticks) ──

type PriceTickCallback = (prices: Map<AssetSymbol, number>) => void;
const tickCallbacks: PriceTickCallback[] = [];

export function onPriceTick(cb: PriceTickCallback): void {
  tickCallbacks.push(cb);
}

// Periodic candle broadcast for subscribed clients
let candleBroadcastCounter = 0;
const CANDLE_BROADCAST_EVERY_N_POLLS = 1; // broadcast candles every poll (~2s)

async function broadcastCandles(): Promise<void> {
  const assets = CONFIG.VALID_ASSETS;
  for (const asset of assets) {
    if (!hasCandleSubscribers(asset)) continue;
    try {
      const candles = await fetchCandles(asset, '1m', 1);
      if (candles.length > 0) {
        broadcastCandleUpdate(asset, candles[candles.length - 1]);
      }
    } catch {
      // Non-critical: skip candle broadcast on error
    }
  }
}

async function pollAndNotify(): Promise<void> {
  await pollPrices();
  for (const cb of tickCallbacks) {
    try {
      cb(currentPrices);
    } catch (err) {
      console.error('[priceService] Tick callback error:', err);
    }
  }

  // Broadcast candles periodically (every ~6s)
  candleBroadcastCounter++;
  if (candleBroadcastCounter >= CANDLE_BROADCAST_EVERY_N_POLLS) {
    candleBroadcastCounter = 0;
    broadcastCandles();
  }
}

export function startPricePolling(): void {
  if (pollingTimer) return;
  console.log(`[priceService] Starting price polling (${CONFIG.PRICE_POLL_INTERVAL_MS}ms)`);

  // Initial fetch
  pollAndNotify();

  pollingTimer = setInterval(pollAndNotify, CONFIG.PRICE_POLL_INTERVAL_MS);
}

export function stopPricePolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}
