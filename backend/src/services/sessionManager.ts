import { sessionRepo } from '../db/repositories/sessionRepo';
import { positionRepo } from '../db/repositories/positionRepo';
import { tradeRepo } from '../db/repositories/tradeRepo';
import { optionRepo } from '../db/repositories/optionRepo';
import { playerRepo } from '../db/repositories/playerRepo';
import { CONFIG } from '../config';
import { AppError, ErrorCode } from '../domain/errors';
import { getCurrentPrice } from './priceService';
import { tradingEngine } from './tradingEngine';
import { playerService } from './playerService';
import { achievementEngine } from './achievementEngine';
import { withTransaction, getDb } from '../db/connection';
import { sendToPlayer } from '../ws/broadcaster';
import type { SessionRow, PositionRow, TradeRow, Portfolio, AssetSymbol, OptionTradeRow } from '../domain/types';

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export const sessionManager = {
  startSession(playerId: number): SessionRow {
    // Check for existing active session
    const existing = sessionRepo.findActiveByPlayer(playerId);
    if (existing) {
      throw new AppError(ErrorCode.SESSION_ALREADY_ACTIVE, 'You already have an active session');
    }

    // Check reset cooldown
    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');
    const cooldownUntil = (player as unknown as Record<string, unknown>).reset_cooldown_until as number || 0;
    if (cooldownUntil > Date.now()) {
      const remainingSec = Math.ceil((cooldownUntil - Date.now()) / 1000);
      throw new AppError(ErrorCode.SESSION_ALREADY_ACTIVE, `Account in cooldown. ${remainingSec}s remaining.`);
    }

    // Record starting XP for accurate session XP tracking
    const startingXp = player?.xp ?? 0;
    const session = sessionRepo.create(playerId, CONFIG.STARTING_BALANCE, startingXp);
    return session;
  },

  getCurrentSession(playerId: number): {
    session: SessionRow;
    positions: PositionRow[];
    trades: TradeRow[];
    portfolio: Portfolio;
    balance: number;
  } {
    const session = sessionRepo.findActiveByPlayer(playerId);
    if (!session) {
      throw new AppError(ErrorCode.NO_ACTIVE_SESSION, 'No active session');
    }

    const positions = positionRepo.findAllBySession(session.id);
    const trades = tradeRepo.findBySession(session.id);
    const openPositions = positions.filter((p) => p.status === 'open');
    const activeOptions = optionRepo.findActiveBySession(session.id);
    const settledOptionTrades = optionRepo.findTradesBySession(session.id);

    // Calculate current balance including option premiums, settled option PnL, and prediction bets
    const realizedPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const lockedMargin = openPositions.reduce((sum, p) => sum + p.margin, 0);
    const optionPremiumsPaid = activeOptions.reduce((sum, o) => sum + o.premium, 0);
    const optionPnl = settledOptionTrades.reduce((sum, t) => sum + t.pnl, 0);
    const predictionPnl = (session as unknown as Record<string, unknown>).prediction_pnl as number || 0;
    const balance = session.starting_balance + realizedPnl - lockedMargin - optionPremiumsPaid + optionPnl + predictionPnl;

    // Calculate unrealized PnL
    let unrealizedPnl = 0;
    for (const pos of openPositions) {
      const price = getCurrentPrice(pos.asset as AssetSymbol);
      if (price) {
        unrealizedPnl += tradingEngine.calculateUnrealizedPnl(pos, price);
      }
    }

    const portfolio: Portfolio = {
      balance,
      startingBalance: session.starting_balance,
      lockedMargin,
      unrealizedPnl,
      totalPnl: realizedPnl,
      totalTrades: trades.length,
      winCount: trades.filter((t) => t.result === 'profit').length,
      lossCount: trades.filter((t) => t.result === 'loss' || t.result === 'liquidated').length,
    };

    // Drawdown tracking: update daily_high_balance and check drawdown limit
    const currentHigh = session.daily_high_balance || session.starting_balance;
    const effectiveBalance = balance + unrealizedPnl;
    if (effectiveBalance > currentHigh) {
      const db = getDb();
      db.query('UPDATE trading_sessions SET daily_high_balance = ? WHERE id = ?').run(effectiveBalance, session.id);
    }
    const highWaterMark = Math.max(currentHigh, effectiveBalance);
    if (highWaterMark > 0) {
      const drawdownPct = (highWaterMark - effectiveBalance) / highWaterMark;
      if (drawdownPct >= CONFIG.DAILY_DRAWDOWN_LIMIT_PCT && !session.drawdown_lockout_until) {
        const lockoutUntil = Date.now() + CONFIG.RESET_COOLDOWN_MS;
        const db = getDb();
        db.query('UPDATE trading_sessions SET drawdown_lockout_until = ? WHERE id = ?').run(lockoutUntil, session.id);
        sendToPlayer(playerId, {
          type: 'drawdown_lockout',
          drawdown_pct: Math.round(drawdownPct * 10000) / 100,
          lockout_until: lockoutUntil,
        });
      }
    }

    return { session, positions, trades, portfolio, balance };
  },

  endSession(playerId: number): {
    session: SessionRow;
    trades: TradeRow[];
    finalBalance: number;
    totalPnl: number;
    xpEarned: number;
  } {
    const session = sessionRepo.findActiveByPlayer(playerId);
    if (!session) {
      throw new AppError(ErrorCode.NO_ACTIVE_SESSION, 'No active session');
    }

    return withTransaction(() => {
      // Force-close all open positions
      const openPositions = positionRepo.findOpenBySession(session.id);

      for (const pos of openPositions) {
        const price = getCurrentPrice(pos.asset as AssetSymbol);
        if (price) {
          const result = tradingEngine.closePositionCalc(pos, price);
          positionRepo.close(pos.id, price, result.pnl, 'closed');
          tradeRepo.create({
            ...result.trade,
            session_id: session.id,
            player_id: playerId,
          });
        }
      }

      // Force-settle active options with real PnL (B14)
      const activeOptions = optionRepo.findActiveBySession(session.id);
      let optionPnl = 0;
      for (const opt of activeOptions) {
        const price = getCurrentPrice(opt.asset as AssetSymbol);
        if (price) {
          const isITM = opt.option_type === 'call'
            ? price > opt.strike_price
            : price < opt.strike_price;
          const payout = isITM ? opt.premium * CONFIG.OPTION_PAYOUT_MULTIPLIER : 0;
          const pnl = payout - opt.premium;
          optionRepo.settle(opt.id, price, pnl);
          optionPnl += pnl;

          // Create option trade record
          optionRepo.createTrade({
            id: genId('otrade'),
            option_id: opt.id,
            session_id: session.id,
            player_id: playerId,
            asset: opt.asset,
            option_type: opt.option_type,
            strike_price: opt.strike_price,
            premium: opt.premium,
            expiry: opt.expiry,
            spot_at_open: opt.spot_at_open,
            settlement_price: price,
            pnl,
            opened_at: opt.opened_at,
            settled_at: Date.now(),
            result: isITM ? 'itm' : 'otm',
          } as OptionTradeRow);
        }
      }

      // Calculate final metrics (include ALL option PnL -- both previously-settled and force-settled)
      const allTrades = tradeRepo.findBySession(session.id);
      const optionCount = optionRepo.countBySession(session.id);
      const tradePnl = allTrades.reduce((sum, t) => sum + t.pnl, 0);
      const allOptionTrades = optionRepo.findTradesBySession(session.id);
      const allOptionPnl = allOptionTrades.reduce((sum, t) => sum + t.pnl, 0);
      const totalPnl = tradePnl + allOptionPnl;
      const finalBalance = session.starting_balance + totalPnl;

      // Calculate risk-adjusted score (Sharpe-like: mean/stddev with sample variance)
      let sharpeRatio = 0;
      let maxDrawdown = 0;
      if (allTrades.length > 1) {
        const returns = allTrades.map((t) => t.pnl_percent / 100);
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
        sharpeRatio = variance > 0 ? mean / Math.sqrt(variance) : 0;

        // Max drawdown: track running balance through trades
        let peak = session.starting_balance;
        let runningBalance = session.starting_balance;
        for (const t of allTrades) {
          runningBalance += t.pnl;
          if (runningBalance > peak) peak = runningBalance;
          const drawdown = (peak - runningBalance) / peak;
          if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
      }

      // Session XP bonus
      let sessionBonus = 0;
      if (allTrades.length >= 5 && totalPnl > 0) {
        sessionBonus = 20; // Profitable session bonus
      }

      // Update player stats
      playerRepo.incrementSessions(playerId);
      if (totalPnl !== 0) {
        playerRepo.updateStats(playerId, {
          total_pnl: totalPnl,
          best_pnl_pct: (totalPnl / session.starting_balance) * 100,
        });
      }

      if (sessionBonus > 0) {
        playerService.awardXp(playerId, sessionBonus, 'Session end bonus');
      }

      // B17: Check achievements at session end
      achievementEngine.checkAfterTrade(playerId, session.id);

      // Compute total XP earned during session (cumulative: trade XP + achievement XP + pattern/prediction XP + bonus)
      const currentPlayer = playerRepo.findById(playerId);
      const totalSessionXp = (currentPlayer?.xp ?? 0) - (session.starting_xp || 0);
      const xpEarned = Math.max(0, totalSessionXp);

      const endedSession = sessionRepo.end(
        session.id, finalBalance, totalPnl,
        allTrades.length, optionCount, xpEarned,
        sharpeRatio, maxDrawdown,
      );

      // Auto-trigger cooldown + XP penalty if account is blown
      if (finalBalance <= 0) {
        const currentPlayerAfter = playerRepo.findById(playerId);
        if (currentPlayerAfter) {
          const xpPenalty = Math.floor(currentPlayerAfter.xp * CONFIG.RESET_XP_PENALTY_PCT);
          if (xpPenalty > 0) {
            playerService.penalizeXp(playerId, xpPenalty, 'Account blown');
          }
          const cooldownUntil = Date.now() + CONFIG.RESET_COOLDOWN_MS;
          playerRepo.updateStats(playerId, { reset_cooldown_until: cooldownUntil });
          sendToPlayer(playerId, {
            type: 'account_blown',
            cooldown_until: cooldownUntil,
            xp_penalty: xpPenalty,
          });
        }
      }

      return {
        session: endedSession,
        trades: allTrades,
        finalBalance,
        totalPnl,
        xpEarned,
      };
    });
  },

  /** Force-end sessions that have been active for more than 24 hours */
  cleanupStaleSessions(): number {
    const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
    const staleSessions = sessionRepo.findStaleActive(STALE_THRESHOLD_MS);
    let cleaned = 0;

    for (const session of staleSessions) {
      try {
        // Force-close open positions at current or entry price
        const openPositions = positionRepo.findOpenBySession(session.id);
        for (const pos of openPositions) {
          const price = getCurrentPrice(pos.asset as AssetSymbol) || pos.entry_price;
          const result = tradingEngine.closePositionCalc(pos, price);
          positionRepo.close(pos.id, price, result.pnl, 'closed');
          tradeRepo.create({
            ...result.trade,
            session_id: session.id,
            player_id: session.player_id,
          });
        }

        // Force-settle active options
        const activeOptions = optionRepo.findActiveBySession(session.id);
        for (const opt of activeOptions) {
          const price = getCurrentPrice(opt.asset as AssetSymbol) || opt.spot_at_open;
          const pnl = -opt.premium; // OTM default for stale cleanup
          optionRepo.settle(opt.id, price, pnl);
        }

        // End the session
        const allTrades = tradeRepo.findBySession(session.id);
        const tradePnl = allTrades.reduce((sum, t) => sum + t.pnl, 0);
        const allOptionTrades = optionRepo.findTradesBySession(session.id);
        const allOptionPnl = allOptionTrades.reduce((sum, t) => sum + t.pnl, 0);
        const totalPnl = tradePnl + allOptionPnl;
        const finalBalance = session.starting_balance + totalPnl;

        sessionRepo.end(session.id, finalBalance, totalPnl, allTrades.length, 0, 0);
        cleaned++;
        console.log(`[sessionManager] Cleaned up stale session ${session.id} (player ${session.player_id})`);
      } catch (err) {
        // If cleanup fails, force-end at starting balance
        try {
          sessionRepo.end(session.id, session.starting_balance, 0, 0, 0, 0);
          cleaned++;
          console.error(`[sessionManager] Force-ended stale session ${session.id}:`, err);
        } catch (innerErr) {
          console.error(`[sessionManager] Failed to cleanup session ${session.id}:`, innerErr);
        }
      }
    }

    if (cleaned > 0) {
      console.log(`[sessionManager] Cleaned up ${cleaned} stale sessions`);
    }
    return cleaned;
  },

  /** Reset a blown session: XP penalty + cooldown. Returns cooldown info. */
  resetSession(playerId: number): { cooldown_until: number; xp_penalty: number } {
    const session = sessionRepo.findActiveByPlayer(playerId);
    if (session) {
      // Force-end the session
      sessionRepo.end(session.id, 0, -session.starting_balance, 0, 0, 0);
    }

    // Apply XP penalty
    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');
    const xpPenalty = Math.floor(player.xp * CONFIG.RESET_XP_PENALTY_PCT);
    playerService.penalizeXp(playerId, xpPenalty, 'Account reset');

    // Set cooldown
    const cooldownUntil = Date.now() + CONFIG.RESET_COOLDOWN_MS;
    playerRepo.updateStats(playerId, {
      reset_cooldown_until: cooldownUntil,
      total_resets: ((player as unknown as Record<string, unknown>).total_resets as number || 0) + 1,
    });

    return { cooldown_until: cooldownUntil, xp_penalty: xpPenalty };
  },

  /** Calculate balance for a session from first principles */
  getSessionBalance(sessionId: number, startingBalance: number): number {
    const trades = tradeRepo.findBySession(sessionId);
    const openPositions = positionRepo.findOpenBySession(sessionId);
    const activeOptions = optionRepo.findActiveBySession(sessionId);
    const settledOptionTrades = optionRepo.findTradesBySession(sessionId);

    const realizedPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const lockedMargin = openPositions.reduce((sum, p) => sum + p.margin, 0);
    const optionPremiumsPaid = activeOptions.reduce((sum, o) => sum + o.premium, 0);
    const optionPnl = settledOptionTrades.reduce((sum, t) => sum + t.pnl, 0);

    // Include prediction bet P/L
    const session = sessionRepo.findById(sessionId);
    const predictionPnl = session ? ((session as unknown as Record<string, unknown>).prediction_pnl as number || 0) : 0;

    return startingBalance + realizedPnl - lockedMargin - optionPremiumsPaid + optionPnl + predictionPnl;
  },
};
