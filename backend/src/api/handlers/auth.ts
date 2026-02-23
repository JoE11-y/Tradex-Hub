import type { Context } from 'hono';
import { playerService } from '../../services/playerService';
import { playerRepo } from '../../db/repositories/playerRepo';
import { sorobanClient } from '../../services/sorobanClient';
import { parse, walletSchema, verifySchema } from '../validate';

/** Fire-and-forget on-chain registration (non-blocking) */
function registerOnChain(walletAddress: string) {
  if (!sorobanClient.isConfigured()) return;
  sorobanClient.registerPlayer(walletAddress).catch((e) => {
    console.warn('[auth] On-chain registration failed (non-blocking):', e);
  });
}

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
    registerOnChain(wallet_address);
    return c.json({ token, player: profile });
  },

  devLogin: async (c: Context) => {
    const body = await c.req.json();
    const { wallet_address } = parse(walletSchema, body);
    const { token, player } = playerService.devLogin(wallet_address);
    const profile = playerService.getProfile(player.id);
    registerOnChain(wallet_address);
    return c.json({ token, player: profile });
  },
};
