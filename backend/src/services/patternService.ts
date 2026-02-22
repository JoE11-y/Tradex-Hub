import { readFileSync } from 'fs';
import { join } from 'path';
import { getDb } from '../db/connection';
import { playerRepo } from '../db/repositories/playerRepo';
import { sessionRepo } from '../db/repositories/sessionRepo';
import { playerService } from './playerService';
import { CONFIG } from '../config';
import { AppError, ErrorCode } from '../domain/errors';
import { getStreakMultiplier, getLevelForXp } from '../domain/types';
import { achievementEngine } from './achievementEngine';
import type { PatternEntry, PatternName, PatternChallengeRow } from '../domain/types';

// ── Pattern library (loaded once) ──

let patternLibrary: PatternEntry[] = [];

function loadPatternLibrary(): PatternEntry[] {
  if (patternLibrary.length > 0) return patternLibrary;
  const filePath = join(import.meta.dir, '..', 'data', 'patterns.json');
  try {
    const raw = readFileSync(filePath, 'utf-8');
    patternLibrary = JSON.parse(raw) as PatternEntry[];
    console.log(`[patternService] Loaded ${patternLibrary.length} patterns`);
  } catch (err) {
    console.error(`[patternService] Failed to load patterns.json: ${err}`);
    patternLibrary = [];
  }
  return patternLibrary;
}

// ── In-memory active challenges (simple for hackathon) ──

interface ActiveChallenge {
  id: number;
  patternId: string;
  correctAnswer: PatternName;
  options: string[];
  createdAt: number;
}

const activeChallenges = new Map<number, ActiveChallenge>(); // playerId -> challenge
const recentPatterns = new Map<number, string[]>(); // playerId -> last N pattern IDs

// Clean up stale challenges every 60 seconds (TTL: 5 minutes)
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [playerId, challenge] of activeChallenges) {
    if (now - challenge.createdAt > CHALLENGE_TTL_MS) {
      activeChallenges.delete(playerId);
    }
  }
}, 60_000);

// All pattern names by difficulty for generating distractors
const PATTERN_NAMES: Record<string, PatternName[]> = {
  easy: ['uptrend', 'downtrend', 'support', 'resistance'],
  medium: ['double_top', 'double_bottom', 'bull_flag', 'bear_flag'],
  hard: ['head_and_shoulders', 'inv_head_and_shoulders', 'ascending_triangle', 'descending_triangle'],
};

const ALL_PATTERNS: PatternName[] = [...PATTERN_NAMES.easy, ...PATTERN_NAMES.medium, ...PATTERN_NAMES.hard];

function pickDistractors(correct: PatternName, count: number): PatternName[] {
  const others = ALL_PATTERNS.filter((p) => p !== correct);
  return shuffleArray(others).slice(0, count);
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const patternService = {
  init(): void {
    loadPatternLibrary();
  },

  getChallenge(playerId: number): {
    challenge_id: number;
    candles: PatternEntry['candles'];
    asset: string;
    difficulty: string;
    highlight_start: number;
    highlight_end: number;
    options: string[];
  } {
    const library = loadPatternLibrary();

    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');

    // Filter patterns by player level (difficulty gating)
    const levelInfo = getLevelForXp(player.xp);
    const allowedDifficulties: string[] =
      levelInfo.level >= 6 ? ['easy', 'medium', 'hard'] :
      levelInfo.level >= 3 ? ['easy', 'medium'] :
      ['easy'];
    const filtered = library.filter((p) => allowedDifficulties.includes(p.difficulty));
    const pool = filtered.length > 0 ? filtered : library;

    // Avoid repeating recent patterns for this player
    const recent = recentPatterns.get(playerId) || [];
    const unseenPool = pool.filter((p) => !recent.includes(p.id));
    const selectionPool = unseenPool.length > 0 ? unseenPool : pool;
    const entry = selectionPool[Math.floor(Math.random() * selectionPool.length)];

    // Track recent patterns (keep last half of pool size to ensure variety)
    const maxRecent = Math.max(Math.floor(pool.length / 2), 3);
    const updatedRecent = [...recent, entry.id].slice(-maxRecent);
    recentPatterns.set(playerId, updatedRecent);

    // Generate 3 distractors + correct answer
    const distractors = pickDistractors(entry.pattern, 3);
    const options = shuffleArray([entry.pattern, ...distractors]);

    // Deduct entry fee from active session balance (if session exists)
    const activeSession = sessionRepo.findActiveByPlayer(playerId);
    if (activeSession) {
      const db = getDb();
      db.query('UPDATE trading_sessions SET prediction_pnl = prediction_pnl - ? WHERE id = ?').run(CONFIG.PATTERN_ENTRY_FEE, activeSession.id);
    }

    // Store in memory as active challenge
    const challengeId = Date.now() + Math.floor(Math.random() * 1000);
    activeChallenges.set(playerId, {
      id: challengeId,
      patternId: entry.id,
      correctAnswer: entry.pattern,
      options,
      createdAt: Date.now(),
    });

    return {
      challenge_id: challengeId,
      candles: entry.candles,
      asset: entry.asset,
      difficulty: entry.difficulty,
      highlight_start: entry.highlight_start,
      highlight_end: entry.highlight_end,
      options,
    };
  },

  submitAnswer(playerId: number, challengeId: number, answer: string, timeMs: number): {
    correct: boolean;
    correct_answer: string;
    description: string;
    xp_awarded: number;
    streak: number;
    streak_multiplier: number;
    balance_change: number;
  } {
    const challenge = activeChallenges.get(playerId);
    if (!challenge || challenge.id !== challengeId) {
      throw new AppError(ErrorCode.CHALLENGE_NOT_FOUND, 'Challenge not found or expired');
    }
    activeChallenges.delete(playerId);

    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');

    const library = loadPatternLibrary();
    const entry = library.find((p) => p.id === challenge.patternId);

    const isCorrect = answer === challenge.correctAnswer;
    const currentStreak = player.pattern_streak || 0;
    const newStreak = isCorrect ? currentStreak + 1 : 0;
    const multiplier = getStreakMultiplier(newStreak);

    // Calculate XP (difficulty-weighted: easy=10, medium=15, hard=25)
    const difficultyXp: Record<string, number> = { easy: 10, medium: 15, hard: 25 };
    let xpAwarded = 0;
    if (isCorrect) {
      let baseXp = difficultyXp[entry?.difficulty ?? 'easy'] ?? CONFIG.XP_PATTERN_CORRECT;
      // Speed bonus
      if (timeMs < CONFIG.PATTERN_SPEED_THRESHOLD_MS) {
        const speedFraction = 1 - (timeMs / CONFIG.PATTERN_SPEED_THRESHOLD_MS);
        baseXp += Math.round(CONFIG.XP_PATTERN_SPEED_BONUS * speedFraction);
      }
      xpAwarded = Math.round(baseXp * multiplier);
    }

    // Persist to DB
    const db = getDb();
    db.query(`
      INSERT INTO pattern_challenges (player_id, pattern_id, answer, correct_answer, is_correct, time_ms, xp_awarded, streak_at_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(playerId, challenge.patternId, answer, challenge.correctAnswer, isCorrect ? 1 : 0, timeMs, xpAwarded, newStreak, Date.now());

    // Update player stats
    playerRepo.updateStats(playerId, {
      pattern_total: (player.pattern_total || 0) + 1,
      pattern_correct: isCorrect ? (player.pattern_correct || 0) + 1 : player.pattern_correct || 0,
      pattern_streak: newStreak,
      pattern_best_streak: Math.max(player.pattern_best_streak || 0, newStreak),
    });

    // Award XP
    if (xpAwarded > 0) {
      playerService.awardXp(playerId, xpAwarded, isCorrect ? 'Pattern identified correctly' : '');
    }

    // Balance bonus on correct answer: refund entry fee + bonus
    let balanceChange = 0;
    const activeSession = sessionRepo.findActiveByPlayer(playerId);
    if (activeSession) {
      if (isCorrect) {
        const bonus = CONFIG.PATTERN_ENTRY_FEE + CONFIG.PATTERN_CORRECT_BALANCE_BONUS;
        const db2 = getDb();
        db2.query('UPDATE trading_sessions SET prediction_pnl = prediction_pnl + ? WHERE id = ?').run(bonus, activeSession.id);
        balanceChange = CONFIG.PATTERN_CORRECT_BALANCE_BONUS; // Net: refund + bonus - fee already deducted
      } else {
        balanceChange = -CONFIG.PATTERN_ENTRY_FEE; // Fee was already deducted at challenge fetch
      }
    }

    // Check education achievements
    achievementEngine.checkAfterEducation(playerId);

    return {
      correct: isCorrect,
      correct_answer: challenge.correctAnswer,
      description: entry?.description || '',
      xp_awarded: xpAwarded,
      streak: newStreak,
      streak_multiplier: multiplier,
      balance_change: balanceChange,
    };
  },

  getStats(playerId: number): {
    total: number;
    correct: number;
    accuracy: number;
    current_streak: number;
    best_streak: number;
  } {
    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');

    const total = player.pattern_total || 0;
    const correct = player.pattern_correct || 0;

    return {
      total,
      correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      current_streak: player.pattern_streak || 0,
      best_streak: player.pattern_best_streak || 0,
    };
  },
};
