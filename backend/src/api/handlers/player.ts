import type { Context } from 'hono';
import { playerService } from '../../services/playerService';
import { playerRepo } from '../../db/repositories/playerRepo';
import { parse, displayNameSchema } from '../validate';

export const playerHandlers = {
  getProfile: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const profile = playerService.getProfile(playerId);
    return c.json(profile);
  },

  updateProfile: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const body = await c.req.json();
    const { display_name } = parse(displayNameSchema, body);
    playerRepo.updateDisplayName(playerId, display_name);
    const profile = playerService.getProfile(playerId);
    return c.json(profile);
  },
};
