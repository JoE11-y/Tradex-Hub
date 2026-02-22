import type { Context } from 'hono';
import { predictionService } from '../../services/predictionService';
import { parse, predictionChallengeSchema, predictionAnswerSchema } from '../validate';
import type { AssetSymbol } from '../../domain/types';

export const predictionHandlers = {
  challenge: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const body = await c.req.json().catch(() => ({}));
    const params = parse(predictionChallengeSchema, body);
    const result = await predictionService.getChallenge(
      playerId,
      params.asset as AssetSymbol | undefined,
      params.timeframe,
    );
    return c.json(result);
  },

  answer: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const body = await c.req.json();
    const { challenge_id, direction, magnitude, bet_amount } = parse(predictionAnswerSchema, body);
    const result = predictionService.submitAnswer(playerId, challenge_id, direction, magnitude, bet_amount);
    return c.json(result);
  },

  stats: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const result = predictionService.getStats(playerId);
    return c.json(result);
  },
};
