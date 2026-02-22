// ── Primitives ──
export type OrderSide = 'long' | 'short';
export type PositionStatus = 'open' | 'closed' | 'liquidated';
export type AssetSymbol = 'XLM' | 'BTC' | 'ETH';
export type Leverage = 2 | 5 | 10;
export type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type OptionType = 'call' | 'put';
export type OptionExpiry = '1m' | '5m' | '15m' | '1h';
export type OptionStatus = 'active' | 'settled';
export type SessionStatus = 'active' | 'ended';
export type TradeResult = 'profit' | 'loss' | 'liquidated';
export type OptionResult = 'itm' | 'otm';

// ── Database rows ──
export interface PlayerRow {
  id: number;
  wallet_address: string;
  display_name: string;
  xp: number;
  level: number;
  win_streak: number;
  longest_hold_ms: number;
  near_liq_closes: number;
  total_sessions: number;
  total_trades: number;
  total_pnl: number;
  best_pnl_pct: number;
  created_at: number;
  // Education module stats
  pattern_correct: number;
  pattern_total: number;
  pattern_streak: number;
  pattern_best_streak: number;
  prediction_correct: number;
  prediction_total: number;
  prediction_streak: number;
  credibility_score: number;
  // Risk management stats
  reset_cooldown_until: number;
  total_resets: number;
  sl_placements: number;
  consecutive_sl_trades: number;
  good_rr_trades: number;
}

export interface AuthTokenRow {
  token: string;
  player_id: number;
  expires_at: number;
}

export interface SessionRow {
  id: number;
  player_id: number;
  status: SessionStatus;
  starting_balance: number;
  ending_balance: number | null;
  total_pnl: number;
  trade_count: number;
  option_count: number;
  xp_earned: number;
  started_at: number;
  ended_at: number | null;
  sharpe_ratio: number;
  max_drawdown: number;
  starting_xp: number;
  daily_high_balance: number;
  drawdown_lockout_until: number;
}

export interface PositionRow {
  id: string;
  session_id: number;
  player_id: number;
  asset: AssetSymbol;
  side: OrderSide;
  leverage: number;
  entry_price: number;
  quantity: number;
  margin: number;
  liquidation_price: number;
  status: PositionStatus;
  close_price: number | null;
  pnl: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  opened_at: number;
  closed_at: number | null;
}

export interface TradeRow {
  id: string;
  position_id: string;
  session_id: number;
  player_id: number;
  asset: AssetSymbol;
  side: OrderSide;
  leverage: number;
  entry_price: number;
  close_price: number;
  quantity: number;
  margin: number;
  pnl: number;
  pnl_percent: number;
  result: TradeResult;
  opened_at: number;
  closed_at: number;
}

export interface OptionContractRow {
  id: string;
  session_id: number;
  player_id: number;
  asset: AssetSymbol;
  option_type: OptionType;
  strike_price: number;
  spot_at_open: number;
  premium: number;
  expiry: OptionExpiry;
  expires_at: number;
  status: OptionStatus;
  settlement_price: number | null;
  pnl: number | null;
  opened_at: number;
  settled_at: number | null;
}

export interface OptionTradeRow {
  id: string;
  option_id: string;
  session_id: number;
  player_id: number;
  asset: AssetSymbol;
  option_type: OptionType;
  strike_price: number;
  premium: number;
  expiry: OptionExpiry;
  spot_at_open: number;
  settlement_price: number;
  pnl: number;
  opened_at: number;
  settled_at: number;
  result: OptionResult;
}

export interface AchievementRow {
  player_id: number;
  achievement_id: string;
  xp_reward: number;
  unlocked_at: number;
}

export interface PlayerBadgeRow {
  player_id: number;
  badge_id: string;
  badge_type: number;
  proof_hex: string | null;
  public_inputs_hex: string | null;
  soroban_tx_hash: string | null;
  minted_at: number;
}

export interface LeaderboardEntry {
  rank: number;
  player_id: number;
  wallet_address: string;
  display_name: string;
  level: number;
  total_pnl: number;
  best_pnl_pct: number;
  total_trades: number;
  xp: number;
  zk_verified: boolean;
  sharpe_ratio: number;
}

// ── Education module types ──

export type PatternName =
  | 'uptrend' | 'downtrend' | 'support' | 'resistance'
  | 'double_top' | 'double_bottom' | 'bull_flag' | 'bear_flag'
  | 'head_and_shoulders' | 'inv_head_and_shoulders' | 'ascending_triangle' | 'descending_triangle';

export type PatternDifficulty = 'easy' | 'medium' | 'hard';

export interface PatternEntry {
  id: string;
  asset: AssetSymbol;
  pattern: PatternName;
  difficulty: PatternDifficulty;
  candles: Candle[];
  highlight_start: number;
  highlight_end: number;
  description: string;
}

export interface PatternChallengeRow {
  id: number;
  player_id: number;
  pattern_id: string;
  answer: string;
  correct_answer: string;
  is_correct: number;
  time_ms: number;
  xp_awarded: number;
  streak_at_time: number;
  created_at: number;
}

export interface PredictionChallengeRow {
  id: number;
  player_id: number;
  asset: string;
  timeframe: string;
  direction: string;
  actual_direction: string;
  price_change_pct: number;
  is_correct: number;
  magnitude_correct: number;
  xp_awarded: number;
  streak_at_time: number;
  created_at: number;
}

// ── API types ──
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Portfolio {
  balance: number;
  startingBalance: number;
  lockedMargin: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
}

export interface PlayerLevel {
  level: number;
  title: string;
  xpRequired: number;
  maxLeverage: Leverage;
}

export const LEVELS: PlayerLevel[] = [
  // Novice tier (1-5): 2x leverage, easy patterns only
  { level: 1,  title: 'Observer',           xpRequired: 0,      maxLeverage: 2 },
  { level: 2,  title: 'Paper Trader',       xpRequired: 50,     maxLeverage: 2 },
  { level: 3,  title: 'Rookie',             xpRequired: 120,    maxLeverage: 2 },
  { level: 4,  title: 'Student',            xpRequired: 220,    maxLeverage: 2 },
  { level: 5,  title: 'Apprentice',         xpRequired: 350,    maxLeverage: 2 },
  // Trader tier (6-15): 5x leverage, medium patterns, RSI/MACD unlocked
  { level: 6,  title: 'Trader',             xpRequired: 520,    maxLeverage: 5 },
  { level: 7,  title: 'Swing Trader',       xpRequired: 750,    maxLeverage: 5 },
  { level: 8,  title: 'Day Trader',         xpRequired: 1050,   maxLeverage: 5 },
  { level: 9,  title: 'Analyst',            xpRequired: 1400,   maxLeverage: 5 },
  { level: 10, title: 'Strategist',         xpRequired: 1850,   maxLeverage: 5 },
  { level: 11, title: 'Chart Reader',       xpRequired: 2400,   maxLeverage: 5 },
  { level: 12, title: 'Trend Follower',     xpRequired: 3050,   maxLeverage: 5 },
  { level: 13, title: 'Pattern Trader',     xpRequired: 3800,   maxLeverage: 5 },
  { level: 14, title: 'Risk Manager',       xpRequired: 4800,   maxLeverage: 5 },
  { level: 15, title: 'Market Veteran',     xpRequired: 6000,   maxLeverage: 5 },
  // Pro tier (16-25): 10x leverage, hard patterns, all indicators
  { level: 16, title: 'Professional',       xpRequired: 7500,   maxLeverage: 10 },
  { level: 17, title: 'Chart Wizard',       xpRequired: 9500,   maxLeverage: 10 },
  { level: 18, title: 'Market Maker',       xpRequired: 12000,  maxLeverage: 10 },
  { level: 19, title: 'Alpha Seeker',       xpRequired: 15000,  maxLeverage: 10 },
  { level: 20, title: 'Whale Whisperer',    xpRequired: 18500,  maxLeverage: 10 },
  { level: 21, title: 'Volatility Tamer',   xpRequired: 22500,  maxLeverage: 10 },
  { level: 22, title: 'Edge Hunter',        xpRequired: 27000,  maxLeverage: 10 },
  { level: 23, title: 'Portfolio Master',   xpRequired: 31500,  maxLeverage: 10 },
  { level: 24, title: 'Risk Architect',     xpRequired: 35500,  maxLeverage: 10 },
  { level: 25, title: 'Alpha Hunter',       xpRequired: 37800,  maxLeverage: 10 },
  // Master tier (26-30): 10x leverage, custom features
  { level: 26, title: 'Grandmaster',        xpRequired: 43800,  maxLeverage: 10 },
  { level: 27, title: 'Stellar Sage',       xpRequired: 50500,  maxLeverage: 10 },
  { level: 28, title: 'Market Oracle',      xpRequired: 58000,  maxLeverage: 10 },
  { level: 29, title: 'ZK Legend',          xpRequired: 66000,  maxLeverage: 10 },
  { level: 30, title: 'Tradex Titan',       xpRequired: 75500,  maxLeverage: 10 },
];

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  xpReward: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_blood', name: 'First Blood', description: 'Complete your first trade', xpReward: 25 },
  { id: 'winning_streak', name: 'Winning Streak', description: '5 profitable trades in a row', xpReward: 50 },
  { id: 'diamond_hands', name: 'Diamond Hands', description: 'Hold a position for 10+ minutes', xpReward: 30 },
  { id: 'liquidation_survivor', name: 'Liquidation Survivor', description: 'Close before liquidation 3 times', xpReward: 40 },
  { id: 'ten_trades', name: 'Getting Started', description: 'Complete 10 trades', xpReward: 35 },
  { id: 'profitable_session', name: 'In The Green', description: 'End a session with positive P&L', xpReward: 45 },
  { id: 'badge_collector', name: 'Badge Collector', description: 'Mint your first badge on-chain', xpReward: 50 },
  { id: 'risk_manager', name: 'Risk Manager', description: '5 consecutive trades using stop-loss', xpReward: 40 },
  { id: 'good_rr', name: 'Smart Reward', description: '3 trades closed at 2:1+ risk-reward ratio', xpReward: 45 },
  { id: 'drawdown_survivor', name: 'Drawdown Survivor', description: 'Recover from a 4%+ drawdown', xpReward: 50 },
  { id: 'fifty_trades', name: 'Half Century', description: 'Complete 50 trades', xpReward: 60 },
  { id: 'century_trader', name: 'Century Trader', description: 'Complete 100 trades', xpReward: 100 },
  { id: 'iron_streak', name: 'Iron Streak', description: '10 profitable trades in a row', xpReward: 75 },
  // Education module achievements
  { id: 'pattern_novice', name: 'Pattern Spotter', description: 'Identify 10 patterns correctly', xpReward: 30 },
  { id: 'pattern_master', name: 'Pattern Master', description: '25 correct in a row (pattern streak)', xpReward: 75 },
  { id: 'prediction_novice', name: 'Market Oracle', description: 'Make 10 correct predictions', xpReward: 30 },
  { id: 'prediction_master', name: 'Crystal Ball', description: '80%+ credibility score (min 20 predictions)', xpReward: 75 },
  { id: 'all_rounder', name: 'Renaissance Trader', description: 'Complete 10+ challenges in each module', xpReward: 50 },
];

export function getStreakMultiplier(streak: number): number {
  if (streak >= 10) return 2.0;
  if (streak >= 6) return 1.5;
  if (streak >= 3) return 1.25;
  return 1.0;
}

export function getLevelForXp(xp: number): PlayerLevel {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) return LEVELS[i];
  }
  return LEVELS[0];
}

// -- Badge definitions (circuit numeric types) --

export type BadgeStat = 'total_xp' | 'total_trades' | 'win_streak' | 'longest_hold_ms' | 'near_liq_closes' | 'total_sessions' | 'profitable_sessions' | 'verified_sessions' | 'pattern_correct' | 'pattern_streak' | 'prediction_correct' | 'credibility_score';

export interface BadgeDef {
  id: string;
  name: string;
  type: number;
  threshold: number;
  stat: BadgeStat;
}

export const BADGE_DEFS: BadgeDef[] = [
  // Level badges (types 0-9) -- check total_xp
  { id: 'level_1',  name: 'Observer',        type: 0,  threshold: 0,      stat: 'total_xp' },
  { id: 'level_2',  name: 'Rookie Trader',   type: 1,  threshold: 100,    stat: 'total_xp' },
  { id: 'level_3',  name: 'Apprentice',      type: 2,  threshold: 300,    stat: 'total_xp' },
  { id: 'level_4',  name: 'Swing Trader',    type: 3,  threshold: 600,    stat: 'total_xp' },
  { id: 'level_5',  name: 'Day Trader',      type: 4,  threshold: 1000,   stat: 'total_xp' },
  { id: 'level_6',  name: 'Chart Wizard',    type: 5,  threshold: 1600,   stat: 'total_xp' },
  { id: 'level_7',  name: 'Market Maker',    type: 6,  threshold: 2500,   stat: 'total_xp' },
  { id: 'level_8',  name: 'Whale Whisperer', type: 7,  threshold: 4000,   stat: 'total_xp' },
  { id: 'level_9',  name: 'Alpha Hunter',    type: 8,  threshold: 6000,   stat: 'total_xp' },
  { id: 'level_10', name: 'ZK Grandmaster',  type: 9,  threshold: 10000,  stat: 'total_xp' },
  // Achievement badges (types 10-19)
  { id: 'first_blood',          name: 'First Blood',          type: 10, threshold: 1,      stat: 'total_trades' },
  { id: 'winning_streak',       name: 'Winning Streak',       type: 11, threshold: 5,      stat: 'win_streak' },
  { id: 'diamond_hands',        name: 'Diamond Hands',        type: 12, threshold: 600000, stat: 'longest_hold_ms' },
  { id: 'liquidation_survivor', name: 'Liquidation Survivor', type: 13, threshold: 3,      stat: 'near_liq_closes' },
  { id: 'ten_trades',           name: 'Getting Started',      type: 14, threshold: 10,     stat: 'total_trades' },
  { id: 'profitable_session',   name: 'In The Green',         type: 15, threshold: 1,      stat: 'profitable_sessions' },
  { id: 'badge_collector',       name: 'Badge Collector',       type: 16, threshold: 1,      stat: 'verified_sessions' },
  { id: 'fifty_trades',         name: 'Half Century',         type: 17, threshold: 50,     stat: 'total_trades' },
  { id: 'century_trader',       name: 'Century Trader',       type: 18, threshold: 100,    stat: 'total_trades' },
  { id: 'iron_streak',          name: 'Iron Streak',          type: 19, threshold: 10,     stat: 'win_streak' },
  // Education module badges (types 20-24)
  { id: 'pattern_novice',       name: 'Pattern Spotter',      type: 20, threshold: 10,     stat: 'pattern_correct' },
  { id: 'pattern_master',       name: 'Pattern Master',       type: 21, threshold: 25,     stat: 'pattern_streak' },
  { id: 'prediction_novice',    name: 'Market Oracle',        type: 22, threshold: 10,     stat: 'prediction_correct' },
  { id: 'prediction_master',    name: 'Crystal Ball',         type: 23, threshold: 80,     stat: 'credibility_score' },
  { id: 'all_rounder',          name: 'Renaissance Trader',   type: 24, threshold: 10,     stat: 'total_trades' },
];
