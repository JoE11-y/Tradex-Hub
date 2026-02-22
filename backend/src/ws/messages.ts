import type {
  AssetSymbol,
  Candle,
  PositionRow,
  TradeRow,
  Portfolio,
  OptionTradeRow,
  LeaderboardEntry,
  PlayerLevel,
  AchievementDef,
  TimeInterval,
} from '../domain/types';

// ── Client → Server ──
export type ClientMessage =
  | { type: 'subscribe_prices'; assets: AssetSymbol[] }
  | { type: 'unsubscribe_prices'; assets: AssetSymbol[] }
  | { type: 'subscribe_candles'; asset: AssetSymbol; interval: TimeInterval }
  | { type: 'ping' };

// ── Server → Client ──
export type ServerMessage =
  | { type: 'price_update'; asset: AssetSymbol; price: number; timestamp: number }
  | { type: 'candle_update'; asset: AssetSymbol; candle: Candle }
  | { type: 'position_update'; position: PositionRow }
  | { type: 'position_closed_sltp'; position_id: string; status: string; close_price: number; pnl: number; reason: 'stop_loss' | 'take_profit' }
  | { type: 'position_liquidated'; trade: TradeRow; position_id: string }
  | { type: 'portfolio_update'; balance: number; portfolio: Portfolio }
  | { type: 'option_settled'; option_trade: OptionTradeRow; balance: number }
  | { type: 'xp_awarded'; amount: number; reason: string; total_xp: number }
  | { type: 'level_up'; new_level: number; title: string; level_info: PlayerLevel }
  | { type: 'achievement_unlocked'; achievement: AchievementDef & { unlocked_at: number } }
  | { type: 'leaderboard_update'; entries: LeaderboardEntry[] }
  | { type: 'proof_status'; batch_id: number; status: string; soroban_tx?: string }
  | { type: 'pong'; timestamp: number }
  | { type: 'error'; message: string };
