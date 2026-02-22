import type { Context } from 'hono';
import { patternService } from '../../services/patternService';
import { parse, patternAnswerSchema } from '../validate';

export const patternHandlers = {
  challenge: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const result = patternService.getChallenge(playerId);
    return c.json(result);
  },

  answer: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const body = await c.req.json();
    const { challenge_id, answer, time_ms } = parse(patternAnswerSchema, body);
    const result = patternService.submitAnswer(playerId, challenge_id, answer, time_ms);
    return c.json(result);
  },

  stats: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const result = patternService.getStats(playerId);
    return c.json(result);
  },
};
