import { CONFIG } from '../config';
import { AppError, ErrorCode } from '../domain/errors';
import { positionRepo } from '../db/repositories/positionRepo';
import { tradeRepo } from '../db/repositories/tradeRepo';
import { sessionRepo } from '../db/repositories/sessionRepo';
import { playerRepo } from '../db/repositories/playerRepo';
import { playerService } from './playerService';
import { sessionManager } from './sessionManager';
import { achievementEngine } from './achievementEngine';
import { getCurrentPrice, onPriceTick } from './priceService';
import { sendToPlayer } from '../ws/broadcaster';
import { withTransaction } from '../db/connection';
import type {
  PositionRow,
  TradeRow,
  AssetSymbol,
  OrderSide,
  Leverage,
  Portfolio,
} from '../domain/types';
import { getLevelForXp, getStreakMultiplier } from '../domain/types';

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export const tradingEngine = {
  // ── Pure calculations (shared with frontend) ──

  calculateLiquidationPrice(entryPrice: number, side: OrderSide, leverage: Leverage): number {
    const movePercent = CONFIG.LIQUIDATION_THRESHOLD / leverage;
    return side === 'long'
      ? entryPrice * (1 - movePercent)
      : entryPrice * (1 + movePercent);
  },

  calculateUnrealizedPnl(position: PositionRow, currentPrice: number): number {
    const direction = position.side === 'long' ? 1 : -1;
    return (currentPrice - position.entry_price) * direction * position.quantity;
  },

  calculatePnlPercent(position: PositionRow, currentPrice: number): number {
    const pnl = this.calculateUnrealizedPnl(position, currentPrice);
    return (pnl / position.margin) * 100;
  },

  isLiquidated(position: PositionRow, currentPrice: number): boolean {
    return position.side === 'long'
      ? currentPrice <= position.liquidation_price
      : currentPrice >= position.liquidation_price;
  },

  closePositionCalc(position: PositionRow, currentPrice: number): {
    pnl: number;
    pnlPercent: number;
    returnedAmount: number;
    fee: number;
    trade: Omit<TradeRow, 'session_id' | 'player_id'>;
  } {
    const rawPnl = this.calculateUnrealizedPnl(position, currentPrice);
    const closeFee = Math.abs(position.quantity * currentPrice) * CONFIG.TRADING_FEE_PCT;
    const pnl = rawPnl - closeFee;
    const pnlPercent = (pnl / position.margin) * 100;
    const returnedAmount = Math.max(0, position.margin + pnl);

    return {
      pnl,
      pnlPercent,
      returnedAmount,
      fee: closeFee,
      trade: {
        id: genId('trade'),
        position_id: position.id,
        asset: position.asset,
        side: position.side,
        leverage: position.leverage,
        entry_price: position.entry_price,
        close_price: currentPrice,
        quantity: position.quantity,
        margin: position.margin,
        pnl,
        pnl_percent: pnlPercent,
        result: pnl > 0 ? 'profit' : 'loss',
        opened_at: position.opened_at,
        closed_at: Date.now(),
      },
    };
  },

  // ── Server-side actions ──

  openPosition(params: {
    playerId: number;
    sessionId: number;
    asset: AssetSymbol;
    side: OrderSide;
    leverage: Leverage;
    marginAmount: number;
    stopLoss?: number;
    takeProfit?: number;
  }): { position: PositionRow; balance: number; portfolio: Portfolio; xpAwarded: number } {
    const { playerId, sessionId, asset, side, leverage, marginAmount, stopLoss, takeProfit } = params;

    // Validate asset
    if (!CONFIG.VALID_ASSETS.includes(asset)) {
      throw new AppError(ErrorCode.INVALID_ASSET, `Invalid asset: ${asset}`);
    }

    // Validate leverage
    if (!CONFIG.VALID_LEVERAGES.includes(leverage)) {
      throw new AppError(ErrorCode.INVALID_LEVERAGE, `Invalid leverage: ${leverage}`);
    }

    // Check player level allows this leverage
    const player = playerRepo.findById(playerId);
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 'Player not found');
    const levelInfo = getLevelForXp(player.xp);
    if (leverage > levelInfo.maxLeverage) {
      throw new AppError(ErrorCode.LEVERAGE_NOT_UNLOCKED, `Leverage ${leverage}x requires level ${levelInfo.level + 1}`);
    }

    // Validate margin
    if (marginAmount <= 0) {
      throw new AppError(ErrorCode.INVALID_MARGIN, 'Margin must be positive');
    }

    // Get session and check balance
    const session = sessionRepo.findById(sessionId);
    if (!session || session.status !== 'active') {
      throw new AppError(ErrorCode.NO_ACTIVE_SESSION, 'No active session');
    }

    // Check drawdown lockout
    if (session.drawdown_lockout_until && session.drawdown_lockout_until > Date.now()) {
      const remainingSec = Math.ceil((session.drawdown_lockout_until - Date.now()) / 1000);
      throw new AppError(ErrorCode.INSUFFICIENT_BALANCE, `Drawdown lockout active. ${remainingSec}s remaining.`);
    }

    const balance = sessionManager.getSessionBalance(sessionId, session.starting_balance);
    if (marginAmount > balance) {
      throw new AppError(ErrorCode.INSUFFICIENT_BALANCE, 'Insufficient balance');
    }

    // Check max positions
    const openPositions = positionRepo.findOpenBySession(sessionId);
    if (openPositions.length >= CONFIG.MAX_POSITIONS) {
      throw new AppError(ErrorCode.MAX_POSITIONS_REACHED, `Maximum ${CONFIG.MAX_POSITIONS} open positions`);
    }

    // Get current price
    const currentPrice = getCurrentPrice(asset);
    if (!currentPrice) {
      throw new AppError(ErrorCode.PRICE_UNAVAILABLE, 'Price not available yet');
    }

    // Calculate position with opening fee
    const notionalValue = marginAmount * leverage;
    const openFee = notionalValue * CONFIG.TRADING_FEE_PCT;
    const effectiveMargin = marginAmount - openFee;
    const quantity = notionalValue / currentPrice;
    const liquidationPrice = this.calculateLiquidationPrice(currentPrice, side, leverage);

    // Validate stop-loss / take-profit
    if (stopLoss !== undefined) {
      if (side === 'long' && stopLoss >= currentPrice) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Long stop-loss must be below entry price');
      }
      if (side === 'short' && stopLoss <= currentPrice) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Short stop-loss must be above entry price');
      }
    }
    if (takeProfit !== undefined) {
      if (side === 'long' && takeProfit <= currentPrice) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Long take-profit must be above entry price');
      }
      if (side === 'short' && takeProfit >= currentPrice) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Short take-profit must be below entry price');
      }
    }

    const position = positionRepo.create({
      id: genId('pos'),
      session_id: sessionId,
      player_id: playerId,
      asset,
      side,
      leverage,
      entry_price: currentPrice,
      quantity,
      margin: effectiveMargin,
      liquidation_price: liquidationPrice,
      stop_loss: stopLoss ?? null,
      take_profit: takeProfit ?? null,
      status: 'open',
      opened_at: Date.now(),
    });

    // Get updated portfolio (XP awarded on close, not open — B15)
    const { portfolio } = sessionManager.getCurrentSession(playerId);

    return { position, balance: portfolio.balance, portfolio, xpAwarded: 0 };
  },

  closePosition(params: {
    playerId: number;
    positionId: string;
  }): {
    trade: TradeRow;
    balance: number;
    portfolio: Portfolio;
    xpAwarded: number;
    achievements: string[];
  } {
    const { playerId, positionId } = params;

    const position = positionRepo.findById(positionId);
    if (!position) {
      throw new AppError(ErrorCode.POSITION_NOT_FOUND, 'Position not found');
    }
    if (position.player_id !== playerId) {
      throw new AppError(ErrorCode.POSITION_NOT_FOUND, 'Position not found');
    }
    if (position.status !== 'open') {
      throw new AppError(ErrorCode.POSITION_NOT_OPEN, 'Position is not open');
    }

    const currentPrice = getCurrentPrice(position.asset as AssetSymbol);
    if (!currentPrice) {
      throw new AppError(ErrorCode.PRICE_UNAVAILABLE, 'Price not available');
    }

    const result = this.closePositionCalc(position, currentPrice);

    // Persist close in a transaction
    const { trade, xpAwarded, achievements } = withTransaction(() => {
      positionRepo.close(positionId, currentPrice, result.pnl, 'closed');
      const trade = tradeRepo.create({
        ...result.trade,
        session_id: position.session_id,
        player_id: playerId,
      });

      sessionRepo.incrementTradeCount(position.session_id);
      playerRepo.incrementTrades(playerId);

      // XP for trade + profit bonus, with streak multiplier
      let baseXp = CONFIG.XP_TRADE_EXECUTE;
      if (result.pnl > 0) {
        baseXp += CONFIG.XP_TRADE_PROFIT;
      }

      // Update win streak
      const player = playerRepo.findById(playerId);
      let xpAwarded = baseXp;
      if (player) {
        const newStreak = result.pnl > 0 ? player.win_streak + 1 : 0;
        const multiplier = getStreakMultiplier(newStreak);
        xpAwarded = Math.round(baseXp * multiplier);
        playerRepo.updateStats(playerId, { win_streak: newStreak });

        // Track longest hold
        const holdMs = Date.now() - position.opened_at;
        playerRepo.updateStats(playerId, { longest_hold_ms: holdMs });

        // Check near-liquidation close
        const pnlPct = Math.abs(result.pnlPercent);
        if (pnlPct > 60 && result.pnl < 0 && result.trade.result !== 'liquidated') {
          playerRepo.updateStats(playerId, {
            near_liq_closes: (player.near_liq_closes || 0) + 1,
          });
          xpAwarded += CONFIG.XP_NEAR_LIQUIDATION;
        }

        // Risk management XP: stop-loss usage
        if (position.stop_loss !== null) {
          xpAwarded += CONFIG.XP_SL_PLACEMENT;
          const newConsecutiveSl = ((player as unknown as Record<string, unknown>).consecutive_sl_trades as number || 0) + 1;
          playerRepo.updateStats(playerId, {
            sl_placements: ((player as unknown as Record<string, unknown>).sl_placements as number || 0) + 1,
            consecutive_sl_trades: newConsecutiveSl,
          });
        } else {
          // No SL: reset consecutive counter
          playerRepo.updateStats(playerId, { consecutive_sl_trades: 0 });
        }

        // Risk management XP: good risk-reward ratio (2:1+)
        if (result.pnl > 0 && position.stop_loss !== null) {
          const risk = Math.abs(position.entry_price - position.stop_loss) * position.quantity;
          const reward = result.pnl;
          if (risk > 0 && reward / risk >= 2) {
            xpAwarded += CONFIG.XP_GOOD_RR;
            playerRepo.updateStats(playerId, {
              good_rr_trades: ((player as unknown as Record<string, unknown>).good_rr_trades as number || 0) + 1,
            });
          }
        }
      }

      playerService.awardXp(playerId, xpAwarded, result.pnl > 0 ? 'Profitable trade' : 'Trade closed');

      // Check achievements
      const achievements = achievementEngine.checkAfterTrade(playerId, position.session_id);

      return { trade, xpAwarded, achievements };
    });

    // Get updated portfolio
    const { portfolio, balance } = sessionManager.getCurrentSession(playerId);

    // Push portfolio update via WS
    sendToPlayer(playerId, {
      type: 'portfolio_update',
      balance,
      portfolio,
    });

    return { trade, balance, portfolio, xpAwarded, achievements };
  },

  // ── Liquidation loop ──

  checkLiquidationsForAsset(asset: AssetSymbol, price: number): void {
    const openPositions = positionRepo.findAllOpenByAsset(asset);

    for (const pos of openPositions) {
      // Check stop-loss / take-profit BEFORE liquidation
      let slTpTriggered = false;
      let triggerPrice = price;

      if (pos.stop_loss !== null) {
        if (pos.side === 'long' && price <= pos.stop_loss) {
          slTpTriggered = true;
          triggerPrice = pos.stop_loss;
        } else if (pos.side === 'short' && price >= pos.stop_loss) {
          slTpTriggered = true;
          triggerPrice = pos.stop_loss;
        }
      }

      if (!slTpTriggered && pos.take_profit !== null) {
        if (pos.side === 'long' && price >= pos.take_profit) {
          slTpTriggered = true;
          triggerPrice = pos.take_profit;
        } else if (pos.side === 'short' && price <= pos.take_profit) {
          slTpTriggered = true;
          triggerPrice = pos.take_profit;
        }
      }

      if (slTpTriggered) {
        // Close at trigger price (clean fill)
        const result = this.closePositionCalc(pos, triggerPrice);
        positionRepo.close(pos.id, triggerPrice, result.pnl, 'closed');
        tradeRepo.create({
          ...result.trade,
          session_id: pos.session_id,
          player_id: pos.player_id,
        });
        sessionRepo.incrementTradeCount(pos.session_id);
        playerRepo.incrementTrades(pos.player_id);

        // XP for trade
        let xpAwarded = CONFIG.XP_TRADE_EXECUTE;
        if (result.pnl > 0) xpAwarded += CONFIG.XP_TRADE_PROFIT;

        // Risk management XP (same logic as manual close)
        const player = playerRepo.findById(pos.player_id);
        if (player) {
          // Update win streak
          const newStreak = result.pnl > 0 ? player.win_streak + 1 : 0;
          const multiplier = getStreakMultiplier(newStreak);
          xpAwarded = Math.round(xpAwarded * multiplier);
          playerRepo.updateStats(pos.player_id, { win_streak: newStreak });

          // Track longest hold
          const holdMs = Date.now() - pos.opened_at;
          playerRepo.updateStats(pos.player_id, { longest_hold_ms: holdMs });

          // SL placement XP
          if (pos.stop_loss !== null) {
            xpAwarded += CONFIG.XP_SL_PLACEMENT;
            const newConsecutiveSl = (player.consecutive_sl_trades || 0) + 1;
            playerRepo.updateStats(pos.player_id, {
              sl_placements: (player.sl_placements || 0) + 1,
              consecutive_sl_trades: newConsecutiveSl,
            });
          } else {
            playerRepo.updateStats(pos.player_id, { consecutive_sl_trades: 0 });
          }

          // Good R:R XP (2:1+)
          if (result.pnl > 0 && pos.stop_loss !== null) {
            const risk = Math.abs(pos.entry_price - pos.stop_loss) * pos.quantity;
            const reward = result.pnl;
            if (risk > 0 && reward / risk >= 2) {
              xpAwarded += CONFIG.XP_GOOD_RR;
              playerRepo.updateStats(pos.player_id, {
                good_rr_trades: (player.good_rr_trades || 0) + 1,
              });
            }
          }
        }

        playerService.awardXp(pos.player_id, xpAwarded, result.pnl > 0 ? 'SL/TP profit' : 'SL/TP close');

        achievementEngine.checkAfterTrade(pos.player_id, pos.session_id);

        sendToPlayer(pos.player_id, {
          type: 'position_closed_sltp',
          position_id: pos.id,
          status: 'closed',
          close_price: triggerPrice,
          pnl: result.pnl,
          reason: pos.stop_loss !== null && triggerPrice === pos.stop_loss ? 'stop_loss' : 'take_profit',
        });

        try {
          const { portfolio, balance } = sessionManager.getCurrentSession(pos.player_id);
          sendToPlayer(pos.player_id, { type: 'portfolio_update', balance, portfolio });
        } catch { /* session may have ended */ }

        continue; // Skip liquidation check
      }

      if (!this.isLiquidated(pos, price)) continue;

      // Liquidate — use actual market price (B16), not the pre-calculated threshold
      const trade: TradeRow = {
        id: genId('trade'),
        position_id: pos.id,
        session_id: pos.session_id,
        player_id: pos.player_id,
        asset: pos.asset,
        side: pos.side,
        leverage: pos.leverage,
        entry_price: pos.entry_price,
        close_price: price,
        quantity: pos.quantity,
        margin: pos.margin,
        pnl: -pos.margin,
        pnl_percent: -100,
        result: 'liquidated',
        opened_at: pos.opened_at,
        closed_at: Date.now(),
      };

      positionRepo.close(pos.id, price, -pos.margin, 'liquidated');
      tradeRepo.create(trade);
      sessionRepo.incrementTradeCount(pos.session_id);
      playerRepo.incrementTrades(pos.player_id);

      // Reset win streak on liquidation
      playerRepo.updateStats(pos.player_id, { win_streak: 0 });

      // B18: Check achievements on liquidation event
      achievementEngine.checkAfterTrade(pos.player_id, pos.session_id);

      // Push notification
      sendToPlayer(pos.player_id, {
        type: 'position_liquidated',
        trade,
        position_id: pos.id,
      });

      // Push updated portfolio
      try {
        const { portfolio, balance } = sessionManager.getCurrentSession(pos.player_id);
        sendToPlayer(pos.player_id, {
          type: 'portfolio_update',
          balance,
          portfolio,
        });
      } catch {
        // Session may have ended
      }
    }
  },
};

// Register for price ticks
export function initLiquidationLoop(): void {
  onPriceTick((prices) => {
    for (const [asset, price] of prices) {
      try {
        tradingEngine.checkLiquidationsForAsset(asset, price);
      } catch (err) {
        console.error(`[tradingEngine] Liquidation check error for ${asset}:`, err);
      }
    }
  });
  console.log('[tradingEngine] Liquidation loop registered');
}
