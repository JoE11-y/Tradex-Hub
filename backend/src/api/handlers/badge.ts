import type { Context } from 'hono';
import { badgeService } from '../../services/badgeService';
import { sorobanClient } from '../../services/sorobanClient';
import { achievementEngine } from '../../services/achievementEngine';
import { AppError, ErrorCode } from '../../domain/errors';
import { playerRepo } from '../../db/repositories/playerRepo';
import { BADGE_DEFS } from '../../domain/types';
import { parse, badgeIdSchema } from '../validate';

export const badgeHandlers = {
  /** GET /badges/eligible - all badge defs with eligibility + mint status */
  eligible: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const badges = badgeService.getEligibleBadges(playerId);
    return c.json({ badges });
  },

  /** POST /badges/prepare - generate ZK proof for a badge */
  prepare: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const body = await c.req.json();
    const { badge_id } = parse(badgeIdSchema, body);

    const result = await badgeService.generateBadgeProof(playerId, badge_id);
    return c.json(result);
  },

  /** POST /badges/mint - submit badge proof to Soroban and mint on-chain */
  mint: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const body = await c.req.json();
    const { badge_id } = parse(badgeIdSchema, body);

    const badgeDef = BADGE_DEFS.find((d) => d.id === badge_id);
    if (!badgeDef) throw new AppError(ErrorCode.BADGE_NOT_ELIGIBLE, `Unknown badge: ${badge_id}`);

    // Ensure proof exists
    const stored = badgeService.getStoredProof(playerId, badge_id);
    if (!stored?.proof_hex || !stored?.public_inputs_hex) {
      throw new AppError(ErrorCode.BADGE_PROOF_FAILED, 'No proof found. Call /badges/prepare first.');
    }

    // Check if already minted
    if (stored.soroban_tx_hash) {
      return c.json({
        badge_id,
        soroban_tx_hash: stored.soroban_tx_hash,
        already_minted: true,
      });
    }

    // Get player wallet address for on-chain submission
    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');

    // Submit to Soroban — mint_badge returns NFT token_id
    const { txHash, tokenId } = await sorobanClient.mintBadge(
      player.wallet_address,
      badgeDef.name,
      badgeDef.type,
      stored.public_inputs_hex,
      stored.proof_hex,
    );

    // Mark as minted locally
    badgeService.markMinted(playerId, badge_id, txHash, tokenId);

    // Check badge_collector achievement
    achievementEngine.checkBadgeCollector(playerId);

    return c.json({
      badge_id,
      soroban_tx_hash: txHash,
      token_id: tokenId,
      already_minted: false,
    });
  },

  /** GET /badges/mine - badges the player has earned (with proofs/mint status) */
  mine: async (c: Context) => {
    const playerId = c.get('playerId') as number;
    const badges = badgeService.getPlayerBadges(playerId);
    return c.json({ badges });
  },
};
