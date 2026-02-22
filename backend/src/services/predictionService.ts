import { CONFIG, SYMBOL_MAP } from '../config';
import { getDb } from '../db/connection';
import { playerRepo } from '../db/repositories/playerRepo';
import { sessionRepo } from '../db/repositories/sessionRepo';
import { playerService } from './playerService';
import { AppError, ErrorCode } from '../domain/errors';
import { getStreakMultiplier } from '../domain/types';
import { achievementEngine } from './achievementEngine';
import type { AssetSymbol, Candle } from '../domain/types';

// ── Historical segment cache ──

interface CachedSegment {
  asset: AssetSymbol;
  timeframe: string;
  candles: Candle[];
  fetchedAt: number;
}

const segmentCache: CachedSegment[] = [];

async function fetchHistoricalSegment(asset: AssetSymbol, timeframe: string): Promise<Candle[]> {
  const symbol = SYMBOL_MAP[asset];
  if (!symbol) throw new AppError(ErrorCode.INVALID_ASSET, `Unknown asset: ${asset}`);

  // Pick random date 6-24 months ago
  const now = Date.now();
  const minAgo = CONFIG.PREDICTION_MIN_MONTHS_AGO * 30 * 24 * 60 * 60 * 1000;
  const maxAgo = CONFIG.PREDICTION_MAX_MONTHS_AGO * 30 * 24 * 60 * 60 * 1000;
  const randomAgo = minAgo + Math.random() * (maxAgo - minAgo);
  const startTime = now - randomAgo;

  const url = `${CONFIG.BINANCE_BASE}/klines?symbol=${symbol}&interval=${timeframe}&startTime=${Math.floor(startTime)}&limit=100`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new AppError(ErrorCode.PRICE_UNAVAILABLE, `Binance API error: ${res.status}`);
  }

  const data = await res.json() as Array<[number, string, string, string, string, string, ...unknown[]]>;

  return data.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// ── In-memory active challenges ──

type PredictionDirection = 'up' | 'down' | 'sideways';

// Threshold for sideways classification (< 0.5% change)
const SIDEWAYS_THRESHOLD_PCT = 0.5;

interface ActivePrediction {
  id: number;
  asset: AssetSymbol;
  timeframe: string;
  visibleCandles: Candle[];
  hiddenCandles: Candle[];
  actualDirection: PredictionDirection;
  priceChangePct: number;
  createdAt: number;
}

const activePredictions = new Map<number, ActivePrediction>(); // playerId -> prediction

export const predictionService = {
  async getChallenge(playerId: number, asset?: AssetSymbol, timeframe?: string): Promise<{
    challenge_id: number;
    asset: string;
    timeframe: string;
    candles: Candle[];
    cutoff_time: number;
  }> {
    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');

    const chosenAsset: AssetSymbol = asset || (['BTC', 'ETH', 'XLM'] as AssetSymbol[])[Math.floor(Math.random() * 3)];
    const chosenTimeframe = timeframe || '1h';

    // Try cache first
    let candles: Candle[];
    const cached = segmentCache.find(
      (s) => s.asset === chosenAsset && s.timeframe === chosenTimeframe && Date.now() - s.fetchedAt < 600_000,
    );

    if (cached) {
      candles = cached.candles;
    } else {
      candles = await fetchHistoricalSegment(chosenAsset, chosenTimeframe);
      segmentCache.push({ asset: chosenAsset, timeframe: chosenTimeframe, candles, fetchedAt: Date.now() });
      // Trim cache
      while (segmentCache.length > CONFIG.PREDICTION_CACHE_SIZE) {
        segmentCache.shift();
      }
    }

    if (candles.length < 20) {
      throw new AppError(ErrorCode.PRICE_UNAVAILABLE, 'Not enough historical data');
    }

    // Split at 80% cutoff
    const cutoffIdx = Math.floor(candles.length * CONFIG.PREDICTION_VISIBLE_RATIO);
    const visibleCandles = candles.slice(0, cutoffIdx);
    const hiddenCandles = candles.slice(cutoffIdx);

    // Calculate actual direction
    const cutoffPrice = visibleCandles[visibleCandles.length - 1].close;
    const endPrice = hiddenCandles[hiddenCandles.length - 1].close;
    const priceChangePct = ((endPrice - cutoffPrice) / cutoffPrice) * 100;
    const actualDirection: PredictionDirection =
      Math.abs(priceChangePct) < SIDEWAYS_THRESHOLD_PCT ? 'sideways'
        : priceChangePct >= 0 ? 'up' : 'down';

    const challengeId = Date.now() + Math.floor(Math.random() * 1000);

    activePredictions.set(playerId, {
      id: challengeId,
      asset: chosenAsset,
      timeframe: chosenTimeframe,
      visibleCandles,
      hiddenCandles,
      actualDirection,
      priceChangePct,
      createdAt: Date.now(),
    });

    return {
      challenge_id: challengeId,
      asset: chosenAsset,
      timeframe: chosenTimeframe,
      candles: visibleCandles,
      cutoff_time: visibleCandles[visibleCandles.length - 1].time,
    };
  },

  submitAnswer(playerId: number, challengeId: number, direction: PredictionDirection, magnitude?: string, betAmount?: number): {
    correct: boolean;
    actual_direction: PredictionDirection;
    price_change_pct: number;
    magnitude_correct: boolean;
    hidden_candles: Candle[];
    xp_awarded: number;
    streak: number;
    streak_multiplier: number;
    credibility_score: number;
    bet_amount: number;
    bet_pnl: number;
    balance_change: number;
  } {
    const prediction = activePredictions.get(playerId);
    if (!prediction || prediction.id !== challengeId) {
      throw new AppError(ErrorCode.CHALLENGE_NOT_FOUND, 'Prediction challenge not found or expired');
    }
    activePredictions.delete(playerId);

    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');

    const isCorrect = direction === prediction.actualDirection;
    const currentStreak = player.prediction_streak || 0;
    const newStreak = isCorrect ? currentStreak + 1 : 0;
    const multiplier = getStreakMultiplier(newStreak);

    // Magnitude check
    const absPct = Math.abs(prediction.priceChangePct);
    let magnitudeBucket: string;
    if (absPct < 1) magnitudeBucket = 'small';
    else if (absPct < 3) magnitudeBucket = 'medium';
    else if (absPct < 5) magnitudeBucket = 'large';
    else magnitudeBucket = 'huge';

    const magnitudeCorrect = magnitude ? magnitude === magnitudeBucket : false;

    // Calculate XP with streak bonus
    let xpAwarded = 0;
    if (isCorrect) {
      let baseXp = CONFIG.XP_PREDICTION_CORRECT;
      if (magnitudeCorrect) {
        baseXp += CONFIG.XP_PREDICTION_MAGNITUDE_BONUS;
      }
      // Per-streak XP bonus
      baseXp += CONFIG.XP_PREDICTION_STREAK_BONUS * newStreak;
      xpAwarded = Math.round(baseXp * multiplier);
    }

    // Update stats
    const newTotal = (player.prediction_total || 0) + 1;
    const newCorrect = isCorrect ? (player.prediction_correct || 0) + 1 : player.prediction_correct || 0;

    // Rolling credibility score (last 50 predictions)
    const db = getDb();
    const recentRows = db.query(
      'SELECT is_correct FROM prediction_challenges WHERE player_id = ? ORDER BY created_at DESC LIMIT 49',
    ).all(playerId) as { is_correct: number }[];
    const recentCorrect = recentRows.filter((r) => r.is_correct).length + (isCorrect ? 1 : 0);
    const recentTotal = recentRows.length + 1;
    const credibilityScore = Math.round((recentCorrect / recentTotal) * 100);

    // Bet logic: only if player has active session and bet > 0
    let actualBet = 0;
    let betPnl = 0;
    let sessionId: number | null = null;

    if (betAmount && betAmount > 0) {
      const session = sessionRepo.findActiveByPlayer(playerId);
      if (session) {
        sessionId = session.id;
        // Cap bet at reasonable amount (don't allow betting more than balance)
        actualBet = Math.min(betAmount, 1000); // Cap at $1000 per prediction bet
        if (isCorrect) {
          betPnl = actualBet * (CONFIG.OPTION_PAYOUT_MULTIPLIER - 1); // win 0.8x
        } else {
          betPnl = -actualBet; // lose full bet
        }
        // Update session prediction_pnl
        db.query('UPDATE trading_sessions SET prediction_pnl = prediction_pnl + ? WHERE id = ?').run(betPnl, session.id);
      }
    }

    // Persist
    db.query(`
      INSERT INTO prediction_challenges (player_id, asset, timeframe, direction, actual_direction, price_change_pct, is_correct, magnitude_correct, xp_awarded, streak_at_time, bet_amount, bet_pnl, session_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(playerId, prediction.asset, prediction.timeframe, direction, prediction.actualDirection, prediction.priceChangePct, isCorrect ? 1 : 0, magnitudeCorrect ? 1 : 0, xpAwarded, newStreak, actualBet, betPnl, sessionId, Date.now());

    playerRepo.updateStats(playerId, {
      prediction_total: newTotal,
      prediction_correct: newCorrect,
      prediction_streak: newStreak,
      credibility_score: credibilityScore,
    });

    if (xpAwarded > 0) {
      playerService.awardXp(playerId, xpAwarded, isCorrect ? 'Correct price prediction' : '');
    }

    // Balance bonus for correct predictions when no bet placed
    let balanceChange = betPnl; // Start with bet P&L if any
    if (isCorrect && actualBet === 0) {
      const session = sessionRepo.findActiveByPlayer(playerId);
      if (session) {
        db.query('UPDATE trading_sessions SET prediction_pnl = prediction_pnl + ? WHERE id = ?').run(CONFIG.PREDICTION_CORRECT_BALANCE_BONUS, session.id);
        balanceChange = CONFIG.PREDICTION_CORRECT_BALANCE_BONUS;
      }
    }

    // Check education achievements
    achievementEngine.checkAfterEducation(playerId);

    return {
      correct: isCorrect,
      actual_direction: prediction.actualDirection,
      price_change_pct: prediction.priceChangePct,
      magnitude_correct: magnitudeCorrect,
      hidden_candles: prediction.hiddenCandles,
      xp_awarded: xpAwarded,
      streak: newStreak,
      streak_multiplier: multiplier,
      credibility_score: credibilityScore,
      bet_amount: actualBet,
      bet_pnl: betPnl,
      balance_change: balanceChange,
    };
  },

  getStats(playerId: number): {
    total: number;
    correct: number;
    accuracy: number;
    current_streak: number;
    credibility_score: number;
  } {
    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');

    const total = player.prediction_total || 0;
    const correct = player.prediction_correct || 0;

    return {
      total,
      correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      current_streak: player.prediction_streak || 0,
      credibility_score: player.credibility_score || 0,
    };
  },
};
