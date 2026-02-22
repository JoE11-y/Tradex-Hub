import type { Context } from 'hono';
import { getAllPrices, fetchCandles } from '../../services/priceService';
import type { AssetSymbol, TimeInterval } from '../../domain/types';

export const priceHandlers = {
  current: async (c: Context) => {
    const assetsParam = c.req.query('assets');
    const prices = getAllPrices();

    if (assetsParam) {
      const requested = assetsParam.split(',') as AssetSymbol[];
      const filtered: Record<string, number> = {};
      for (const a of requested) {
        if (prices[a] !== undefined) filtered[a] = prices[a];
      }
      return c.json({ prices: filtered, timestamp: Date.now() });
    }

    return c.json({ prices, timestamp: Date.now() });
  },

  candles: async (c: Context) => {
    const asset = (c.req.query('asset') || 'XLM') as AssetSymbol;
    const interval = (c.req.query('interval') || '1m') as TimeInterval;
    const limit = parseInt(c.req.query('limit') || '300', 10);

    const candles = await fetchCandles(asset, interval, limit);
    return c.json({ candles });
  },
};
