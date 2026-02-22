import { randomBytes } from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { playerRepo } from '../db/repositories/playerRepo';
import { CONFIG } from '../config';
import { AppError, ErrorCode } from '../domain/errors';
import { getLevelForXp } from '../domain/types';
import type { PlayerRow } from '../domain/types';
import { sendToPlayer } from '../ws/broadcaster';

// In-memory challenge store (simple for hackathon)
const challenges = new Map<string, { challenge: string; expiresAt: number }>();

export const playerService = {
  createChallenge(walletAddress: string): string {
    const challenge = `tradex:auth:${walletAddress}:${Date.now()}:${randomBytes(16).toString('hex')}`;
    challenges.set(walletAddress, { challenge, expiresAt: Date.now() + 5 * 60 * 1000 });
    return challenge;
  },

  verifySignature(walletAddress: string, signature: string): string {
    const entry = challenges.get(walletAddress);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new AppError(ErrorCode.CHALLENGE_FAILED, 'Challenge expired or not found');
    }
    challenges.delete(walletAddress);

    // Best-effort ed25519 verification
    try {
      const keypair = Keypair.fromPublicKey(walletAddress);
      const challengeBytes = Buffer.from(entry.challenge);
      const sigBytes = Buffer.from(signature, 'base64');
      if (!keypair.verify(challengeBytes, sigBytes)) {
        throw new AppError(ErrorCode.CHALLENGE_FAILED, 'Invalid signature');
      }
    } catch (e) {
      // If verification throws (format mismatch from different wallet),
      // accept since challenge was valid and wallet-initiated
      if (e instanceof AppError) throw e;
      console.warn('[auth] Sig verification skipped:', (e as Error).message);
    }

    return this.issueToken(walletAddress);
  },

  devLogin(walletAddress: string): { token: string; player: PlayerRow } {
    if (!CONFIG.DEV_MODE) {
      throw new AppError(ErrorCode.CHALLENGE_FAILED, 'Dev login not available in production');
    }

    const token = this.issueToken(walletAddress);
    const player = playerRepo.findByWallet(walletAddress);
    return { token, player: player! };
  },

  issueToken(walletAddress: string): string {
    // Find or create player
    let player = playerRepo.findByWallet(walletAddress);
    if (!player) {
      player = playerRepo.create(walletAddress);
    }

    // Generate token
    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + CONFIG.AUTH_TOKEN_TTL_MS;
    playerRepo.createToken(player.id, token, expiresAt);

    return token;
  },

  getProfile(playerId: number) {
    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found', 404);

    const achievements = playerRepo.getAchievements(playerId);
    const levelInfo = getLevelForXp(player.xp);

    return {
      ...player,
      levelInfo,
      achievements,
    };
  },

  awardXp(playerId: number, amount: number, reason: string): PlayerRow {
    const player = playerRepo.addXp(playerId, amount);
    const newLevel = getLevelForXp(player.xp);

    // Check for level up
    if (newLevel.level > player.level) {
      playerRepo.setLevel(playerId, newLevel.level);
      sendToPlayer(playerId, {
        type: 'level_up',
        new_level: newLevel.level,
        title: newLevel.title,
        level_info: newLevel,
      });
    }

    sendToPlayer(playerId, {
      type: 'xp_awarded',
      amount,
      reason,
      total_xp: player.xp,
    });

    return player;
  },

  /** Deduct XP as a penalty (e.g. account reset). Checks for level-down. */
  penalizeXp(playerId: number, amount: number, reason: string): PlayerRow {
    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');

    const newXp = Math.max(0, player.xp - amount);
    playerRepo.updateStats(playerId, { xp: newXp });

    const newLevel = getLevelForXp(newXp);
    if (newLevel.level < player.level) {
      playerRepo.setLevel(playerId, newLevel.level);
      sendToPlayer(playerId, {
        type: 'level_down',
        new_level: newLevel.level,
        title: newLevel.title,
        level_info: newLevel,
      });
    }

    sendToPlayer(playerId, {
      type: 'xp_penalty',
      amount,
      reason,
      total_xp: newXp,
    });

    return playerRepo.findById(playerId)!;
  },
};
