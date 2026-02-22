import type { Context } from 'hono';
import { playerService } from '../../services/playerService';
import { playerRepo } from '../../db/repositories/playerRepo';
import { parse, walletSchema, verifySchema } from '../validate';

export const authHandlers = {
  challenge: async (c: Context) => {
    const body = await c.req.json();
    const { wallet_address } = parse(walletSchema, body);
    const challenge = playerService.createChallenge(wallet_address);
    return c.json({ challenge });
  },

  verify: async (c: Context) => {
    const body = await c.req.json();
    const { wallet_address, signature } = parse(verifySchema, body);
    const token = playerService.verifySignature(wallet_address, signature);
    const player = playerRepo.findByWallet(wallet_address);
    const profile = playerService.getProfile(player!.id);
    return c.json({ token, player: profile });
  },

  devLogin: async (c: Context) => {
    const body = await c.req.json();
    const { wallet_address } = parse(walletSchema, body);
    const { token, player } = playerService.devLogin(wallet_address);
    const profile = playerService.getProfile(player.id);
    return c.json({ token, player: profile });
  },
};
