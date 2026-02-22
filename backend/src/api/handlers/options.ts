import type { Context } from 'hono';
import { optionsEngine } from '../../services/optionsEngine';
import { sessionRepo } from '../../db/repositories/sessionRepo';
import { getCurrentPrice } from '../../services/priceService';
import { AppError, ErrorCode } from '../../domain/errors';
import { parse, optionOpenSchema, assetSchema } from '../validate';
import type { AssetSymbol, OptionType, OptionExpiry } from '../../domain/types';

export const optionsHandlers = {
  strikes: async (c: Context) => {
    const asset = parse(assetSchema, c.req.query('asset') || 'XLM') as AssetSymbol;
    const price = getCurrentPrice(asset);
    if (!price) {
      throw new AppError(ErrorCode.PRICE_UNAVAILABLE, 'Price not available');
    }
    const strikes = optionsEngine.getStrikePrices(price);
    return c.json({ asset, spot_price: price, strikes });
  },

  open: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const body = await c.req.json();
    const { asset, option_type, strike_price, expiry, premium } = parse(optionOpenSchema, body);

    const session = sessionRepo.findActiveByPlayer(playerId);
    if (!session) {
      throw new AppError(ErrorCode.NO_ACTIVE_SESSION, 'Start a session first');
    }

    const result = optionsEngine.openOption({
      playerId,
      sessionId: session.id,
      asset: asset as AssetSymbol,
      optionType: option_type as OptionType,
      strikePrice: strike_price,
      expiry: expiry as OptionExpiry,
      premium,
    });

    return c.json(result, 201);
  },
};
