import { playerRepo } from '../db/repositories/playerRepo';
import { getDb } from '../db/connection';
import { AppError, ErrorCode } from '../domain/errors';
import { BADGE_DEFS } from '../domain/types';
import type { BadgeDef, BadgeStat, PlayerRow, PlayerBadgeRow } from '../domain/types';
import { noirProver } from './noirProver';

// BN254 scalar field prime
const BN254_P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Polynomial accumulator multiplier (must match badge_proof circuit)
const POLY_MULT = 997n;


/** Get player stats for badge circuit inputs */
function getPlayerBadgeStats(player: PlayerRow): {
  total_xp: number;
  total_trades: number;
  win_streak: number;
  longest_hold_ms: number;
  near_liq_closes: number;
  total_sessions: number;
  profitable_sessions: number;
  verified_sessions: number;
  pattern_correct: number;
  pattern_streak: number;
  prediction_correct: number;
  credibility_score: number;
} {
  const db = getDb();

  // Count profitable sessions (ended sessions with positive P&L)
  const profitableResult = db.query(
    "SELECT COUNT(*) as cnt FROM trading_sessions WHERE player_id = ? AND status = 'ended' AND total_pnl > 0",
  ).get(player.id) as { cnt: number };

  // Count minted badges (badges with soroban_tx_hash)
  const verifiedResult = db.query(
    "SELECT COUNT(*) as cnt FROM player_badges WHERE player_id = ? AND soroban_tx_hash IS NOT NULL",
  ).get(player.id) as { cnt: number };

  return {
    total_xp: player.xp,
    total_trades: player.total_trades,
    win_streak: player.win_streak,
    longest_hold_ms: player.longest_hold_ms,
    near_liq_closes: player.near_liq_closes,
    total_sessions: player.total_sessions,
    profitable_sessions: profitableResult.cnt,
    verified_sessions: verifiedResult.cnt,
    pattern_correct: player.pattern_correct,
    pattern_streak: player.pattern_best_streak,
    prediction_correct: player.prediction_correct,
    credibility_score: Math.floor(player.credibility_score),
  };
}

/** Get the stat value for a badge definition */
function getStatValue(stats: ReturnType<typeof getPlayerBadgeStats>, stat: BadgeStat): number {
  return stats[stat];
}

/** Compute attestation hash (polynomial accumulator over 12 stats, matching circuit) */
function computeAttestationHash(stats: ReturnType<typeof getPlayerBadgeStats>): bigint {
  let running = 0n;
  running = (running * POLY_MULT + BigInt(stats.total_xp)) % BN254_P;
  running = (running * POLY_MULT + BigInt(stats.total_trades)) % BN254_P;
  running = (running * POLY_MULT + BigInt(stats.win_streak)) % BN254_P;
  running = (running * POLY_MULT + BigInt(stats.longest_hold_ms)) % BN254_P;
  running = (running * POLY_MULT + BigInt(stats.near_liq_closes)) % BN254_P;
  running = (running * POLY_MULT + BigInt(stats.total_sessions)) % BN254_P;
  running = (running * POLY_MULT + BigInt(stats.profitable_sessions)) % BN254_P;
  running = (running * POLY_MULT + BigInt(stats.verified_sessions)) % BN254_P;
  running = (running * POLY_MULT + BigInt(stats.pattern_correct)) % BN254_P;
  running = (running * POLY_MULT + BigInt(stats.pattern_streak)) % BN254_P;
  running = (running * POLY_MULT + BigInt(stats.prediction_correct)) % BN254_P;
  running = (running * POLY_MULT + BigInt(stats.credibility_score)) % BN254_P;
  return running;
}

/** Build circuit inputs as string map for noir_js execute() */
function buildBadgeCircuitInputs(
  playerId: number,
  badgeDef: BadgeDef,
  stats: ReturnType<typeof getPlayerBadgeStats>,
  attestationHash: bigint,
): Record<string, string> {
  return {
    player_id: playerId.toString(),
    badge_type: badgeDef.type.toString(),
    badge_threshold: badgeDef.threshold.toString(),
    attestation_hash: attestationHash.toString(),
    total_xp: stats.total_xp.toString(),
    total_trades: stats.total_trades.toString(),
    win_streak: stats.win_streak.toString(),
    longest_hold_ms: stats.longest_hold_ms.toString(),
    near_liq_closes: stats.near_liq_closes.toString(),
    total_sessions: stats.total_sessions.toString(),
    profitable_sessions: stats.profitable_sessions.toString(),
    verified_sessions: stats.verified_sessions.toString(),
    pattern_correct: stats.pattern_correct.toString(),
    pattern_streak: stats.pattern_streak.toString(),
    prediction_correct: stats.prediction_correct.toString(),
    credibility_score: stats.credibility_score.toString(),
  };
}

// ── Badge persistence (local DB) ──

function getPlayerBadges(playerId: number): PlayerBadgeRow[] {
  const db = getDb();
  return db.query('SELECT * FROM player_badges WHERE player_id = ? ORDER BY minted_at ASC').all(playerId) as PlayerBadgeRow[];
}

function saveBadge(playerId: number, badgeId: string, badgeType: number, proofHex: string, publicInputsHex: string): PlayerBadgeRow {
  const db = getDb();
  return db.query(
    'INSERT INTO player_badges (player_id, badge_id, badge_type, proof_hex, public_inputs_hex, minted_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(player_id, badge_id) DO UPDATE SET proof_hex = excluded.proof_hex, public_inputs_hex = excluded.public_inputs_hex RETURNING *',
  ).get(playerId, badgeId, badgeType, proofHex, publicInputsHex, Date.now()) as PlayerBadgeRow;
}

function markBadgeMinted(playerId: number, badgeId: string, txHash: string, nftTokenId?: number): void {
  const db = getDb();
  db.query('UPDATE player_badges SET soroban_tx_hash = ?, nft_token_id = ? WHERE player_id = ? AND badge_id = ?').run(txHash, nftTokenId ?? null, playerId, badgeId);
}

export const badgeService = {
  /** Returns all badge defs with eligibility status and mint status for the player. */
  getEligibleBadges(playerId: number): (BadgeDef & { eligible: boolean; minted: boolean })[] {
    const player = playerRepo.findById(playerId);
    if (!player) return [];

    const stats = getPlayerBadgeStats(player);
    const mintedBadges = getPlayerBadges(playerId);
    const mintedIds = new Set(mintedBadges.map((b) => b.badge_id));

    return BADGE_DEFS.map((def) => {
      let eligible: boolean;
      if (def.id === 'all_rounder') {
        // all_rounder requires all three modules: trades, patterns, predictions
        eligible = player.total_trades >= 10
          && (player.pattern_total || 0) >= 10
          && (player.prediction_total || 0) >= 10;
      } else {
        const statValue = getStatValue(stats, def.stat);
        eligible = statValue >= def.threshold;
      }
      return { ...def, eligible, minted: mintedIds.has(def.id) };
    });
  },

  /** Returns badges the player has earned (proof generated or minted on-chain). */
  getPlayerBadges(playerId: number): PlayerBadgeRow[] {
    return getPlayerBadges(playerId);
  },

  /** Generate attestation data for the badge circuit (server signs player stats). */
  generateBadgeAttestation(playerId: number): {
    stats: ReturnType<typeof getPlayerBadgeStats>;
    attestation_hash: string;
  } {
    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');

    const stats = getPlayerBadgeStats(player);
    const attestationHash = computeAttestationHash(stats);

    return {
      stats,
      attestation_hash: attestationHash.toString(),
    };
  },

  /** Generate a ZK proof for a specific badge. Stores proof locally. */
  async generateBadgeProof(
    playerId: number,
    badgeId: string,
  ): Promise<{ proof_hex: string; public_inputs_hex: string; badge_id: string; badge_type: number; threshold: number }> {
    const badgeDef = BADGE_DEFS.find((d) => d.id === badgeId);
    if (!badgeDef) throw new AppError(ErrorCode.BADGE_NOT_ELIGIBLE, `Unknown badge: ${badgeId}`);

    // Check if already has proof
    const existing = getPlayerBadges(playerId).find((b) => b.badge_id === badgeId);
    if (existing?.proof_hex) {
      return {
        proof_hex: existing.proof_hex,
        public_inputs_hex: existing.public_inputs_hex ?? '',
        badge_id: badgeId,
        badge_type: badgeDef.type,
        threshold: badgeDef.threshold,
      };
    }

    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');

    const stats = getPlayerBadgeStats(player);

    // all_rounder requires checking all three modules
    if (badgeDef.id === 'all_rounder') {
      if (player.total_trades < 10 || (player.pattern_total || 0) < 10 || (player.prediction_total || 0) < 10) {
        throw new AppError(
          ErrorCode.BADGE_NOT_ELIGIBLE,
          `Not eligible for ${badgeDef.name}: need 10+ trades, patterns, and predictions`,
        );
      }
    } else {
      const statValue = getStatValue(stats, badgeDef.stat);
      if (statValue < badgeDef.threshold) {
        throw new AppError(
          ErrorCode.BADGE_NOT_ELIGIBLE,
          `Not eligible for ${badgeDef.name}: ${badgeDef.stat}=${statValue}, need ${badgeDef.threshold}`,
        );
      }
    }

    const attestationHash = computeAttestationHash(stats);

    // Build circuit inputs for noir_js
    const noirInputs = buildBadgeCircuitInputs(playerId, badgeDef, stats, attestationHash);
    console.log('[badgeService] Generating badge proof in-process for:', badgeId);

    // Generate proof via noir_js + bb.js (in-process)
    const { proofHex, publicInputsHex } = await noirProver.generateBadgeProof(noirInputs);

    console.log(`[badgeService] Badge proof generated: ${proofHex.length / 2} bytes`);

    // Store locally
    saveBadge(playerId, badgeId, badgeDef.type, proofHex, publicInputsHex);

    return {
      proof_hex: proofHex,
      public_inputs_hex: publicInputsHex,
      badge_id: badgeId,
      badge_type: badgeDef.type,
      threshold: badgeDef.threshold,
    };
  },

  /** Mark a badge as minted on-chain after successful Soroban tx. */
  markMinted(playerId: number, badgeId: string, txHash: string, nftTokenId?: number): void {
    markBadgeMinted(playerId, badgeId, txHash, nftTokenId);
  },

  /** Get stored proof for a badge (needed for on-chain submission). */
  getStoredProof(playerId: number, badgeId: string): PlayerBadgeRow | null {
    return getPlayerBadges(playerId).find((b) => b.badge_id === badgeId) ?? null;
  },

  /** Map a badge string ID to its numeric type for the circuit. */
  getBadgeTypeForId(badgeId: string): number | undefined {
    const def = BADGE_DEFS.find((d) => d.id === badgeId);
    return def?.type;
  },
};
