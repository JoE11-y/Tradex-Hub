import type { Context } from 'hono';
import { tradingEngine } from '../../services/tradingEngine';
import { sessionRepo } from '../../db/repositories/sessionRepo';
import { AppError, ErrorCode } from '../../domain/errors';
import { parse, tradeOpenSchema, tradeCloseSchema } from '../validate';
import type { AssetSymbol, OrderSide, Leverage } from '../../domain/types';

export const tradingHandlers = {
  open: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const body = await c.req.json();
    const { asset, side, leverage, margin, stop_loss, take_profit } = parse(tradeOpenSchema, body);

    // Get active session
    const session = sessionRepo.findActiveByPlayer(playerId);
    if (!session) {
      throw new AppError(ErrorCode.NO_ACTIVE_SESSION, 'Start a session first');
    }

    const result = tradingEngine.openPosition({
      playerId,
      sessionId: session.id,
      asset: asset as AssetSymbol,
      side: side as OrderSide,
      leverage: leverage as Leverage,
      marginAmount: margin,
      stopLoss: stop_loss,
      takeProfit: take_profit,
    });

    return c.json(result, 201);
  },

  close: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const body = await c.req.json();
    const { position_id } = parse(tradeCloseSchema, body);

    const result = tradingEngine.closePosition({
      playerId,
      positionId: position_id,
    });

    return c.json(result);
  },
};
