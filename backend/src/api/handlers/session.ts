import type { Context } from 'hono';
import { z } from 'zod';
import { sessionManager } from '../../services/sessionManager';
import { sessionRepo } from '../../db/repositories/sessionRepo';
import { parse } from '../validate';

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().nonnegative().default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const sessionHandlers = {
  start: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const session = sessionManager.startSession(playerId);
    return c.json({ session }, 201);
  },

  current: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const result = sessionManager.getCurrentSession(playerId);
    return c.json(result);
  },

  end: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const result = sessionManager.endSession(playerId);
    return c.json(result);
  },

  reset: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const result = sessionManager.resetSession(playerId);
    return c.json(result);
  },

  history: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const { limit, offset } = parse(historyQuerySchema, {
      limit: c.req.query('limit') ?? '20',
      offset: c.req.query('offset') ?? '0',
    });
    const sessions = sessionRepo.getHistory(playerId, limit, offset);
    return c.json({ sessions });
  },
};
