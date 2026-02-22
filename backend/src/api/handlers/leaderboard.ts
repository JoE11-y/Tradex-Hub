import type { Context } from 'hono';
import { leaderboardService } from '../../services/leaderboardService';
import { parse, leaderboardPeriodSchema } from '../validate';

export const leaderboardHandlers = {
  get: async (c: Context) => {
    const period = parse(leaderboardPeriodSchema, c.req.query('period') || 'all_time');
    const entries = leaderboardService.get(period);
    return c.json({ entries, period });
  },
};
