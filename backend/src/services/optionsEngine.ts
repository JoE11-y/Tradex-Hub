import { CONFIG, EXPIRY_DURATIONS } from '../config';
import { AppError, ErrorCode } from '../domain/errors';
import { optionRepo } from '../db/repositories/optionRepo';
import { sessionRepo } from '../db/repositories/sessionRepo';
import { playerService } from './playerService';
import { sessionManager } from './sessionManager';
import { getCurrentPrice } from './priceService';
import { sendToPlayer } from '../ws/broadcaster';
import type {
  AssetSymbol,
  OptionType,
  OptionExpiry,
  OptionContractRow,
  OptionTradeRow,
} from '../domain/types';

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export const optionsEngine = {
  getStrikePrices(spotPrice: number, count: number = 5): number[] {
    const rawStep = spotPrice * 0.01;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step = Math.round(rawStep / magnitude) * magnitude || magnitude;
    const strikes: number[] = [];
    const halfCount = Math.floor(count / 2);

    for (let i = -halfCount; i <= halfCount; i++) {
      const strike = spotPrice + i * step;
      if (strike > 0) strikes.push(Number(strike.toPrecision(6)));
    }
    return strikes;
  },

  openOption(params: {
    playerId: number;
    sessionId: number;
    asset: AssetSymbol;
    optionType: OptionType;
    strikePrice: number;
    expiry: OptionExpiry;
    premium: number;
  }): { option: OptionContractRow; balance: number } {
    const { playerId, sessionId, asset, optionType, strikePrice, expiry, premium } = params;

    if (!CONFIG.VALID_ASSETS.includes(asset)) {
      throw new AppError(ErrorCode.INVALID_ASSET, `Invalid asset: ${asset}`);
    }
    if (optionType !== 'call' && optionType !== 'put') {
      throw new AppError(ErrorCode.INVALID_EXPIRY, `Invalid option type: ${optionType}`);
    }
    if (!EXPIRY_DURATIONS[expiry]) {
      throw new AppError(ErrorCode.INVALID_EXPIRY, `Invalid expiry: ${expiry}`);
    }
    if (premium <= 0) {
      throw new AppError(ErrorCode.INVALID_MARGIN, 'Premium must be positive');
    }

    const session = sessionRepo.findById(sessionId);
    if (!session || session.status !== 'active') {
      throw new AppError(ErrorCode.NO_ACTIVE_SESSION, 'No active session');
    }

    const balance = sessionManager.getSessionBalance(sessionId, session.starting_balance);
    if (premium > balance) {
      throw new AppError(ErrorCode.INSUFFICIENT_BALANCE, 'Insufficient balance');
    }

    const activeOptions = optionRepo.findActiveBySession(sessionId);
    if (activeOptions.length >= CONFIG.MAX_OPTIONS) {
      throw new AppError(ErrorCode.MAX_OPTIONS_REACHED, `Maximum ${CONFIG.MAX_OPTIONS} active options`);
    }

    const currentPrice = getCurrentPrice(asset);
    if (!currentPrice) {
      throw new AppError(ErrorCode.PRICE_UNAVAILABLE, 'Price not available');
    }

    const now = Date.now();
    const option = optionRepo.createContract({
      id: genId('opt'),
      session_id: sessionId,
      player_id: playerId,
      asset,
      option_type: optionType,
      strike_price: strikePrice,
      spot_at_open: currentPrice,
      premium,
      expiry,
      expires_at: now + EXPIRY_DURATIONS[expiry],
      status: 'active',
      opened_at: now,
    });

    sessionRepo.incrementOptionCount(sessionId);

    // Award XP for trading
    playerService.awardXp(playerId, CONFIG.XP_TRADE_EXECUTE, 'Option opened');

    const newBalance = balance - premium;
    return { option, balance: newBalance };
  },

  settleExpiredOptions(): void {
    const expired = optionRepo.findExpired();

    for (const opt of expired) {
      try {
        const settlementPrice = getCurrentPrice(opt.asset as AssetSymbol);
        if (!settlementPrice) continue;

        const isITM = opt.option_type === 'call'
          ? settlementPrice > opt.strike_price
          : settlementPrice < opt.strike_price;

        // Variable payout: base multiplier + bonus for how deep ITM
        let payout = 0;
        if (isITM) {
          const depthPct = Math.abs(settlementPrice - opt.strike_price) / opt.strike_price;
          // Base 1.5x + up to 1.5x more for deep ITM (capped at 3x)
          const multiplier = Math.min(3, 1.5 + depthPct * 15);
          payout = opt.premium * multiplier;
        }
        const pnl = payout - opt.premium;

        optionRepo.settle(opt.id, settlementPrice, pnl);

        const now = Date.now();
        const optionTrade: OptionTradeRow = {
          id: genId('otrade'),
          option_id: opt.id,
          session_id: opt.session_id,
          player_id: opt.player_id,
          asset: opt.asset,
          option_type: opt.option_type,
          strike_price: opt.strike_price,
          premium: opt.premium,
          expiry: opt.expiry,
          spot_at_open: opt.spot_at_open,
          settlement_price: settlementPrice,
          pnl,
          opened_at: opt.opened_at,
          settled_at: now,
          result: isITM ? 'itm' : 'otm',
        };

        optionRepo.createTrade(optionTrade);

        // XP bonus for profitable option
        if (pnl > 0) {
          playerService.awardXp(opt.player_id, CONFIG.XP_TRADE_PROFIT, 'Option ITM');
        }

        // Get updated balance for WS push
        try {
          const session = sessionRepo.findById(opt.session_id);
          if (session) {
            const balance = sessionManager.getSessionBalance(opt.session_id, session.starting_balance);
            sendToPlayer(opt.player_id, {
              type: 'option_settled',
              option_trade: optionTrade,
              balance, // getSessionBalance already includes settled option PnL
            });
          }
        } catch {
          // session may have ended
        }
      } catch (err) {
        console.error(`[optionsEngine] Settlement error for ${opt.id}:`, err);
      }
    }
  },
};

let optionTimer: ReturnType<typeof setInterval> | null = null;

export function startOptionSettlement(): void {
  if (optionTimer) return;
  console.log('[optionsEngine] Starting option settlement timer');
  optionTimer = setInterval(() => {
    try {
      optionsEngine.settleExpiredOptions();
    } catch (err) {
      console.error('[optionsEngine] Settlement loop error:', err);
    }
  }, CONFIG.OPTION_CHECK_INTERVAL_MS);
}

export function stopOptionSettlement(): void {
  if (optionTimer) {
    clearInterval(optionTimer);
    optionTimer = null;
  }
}
