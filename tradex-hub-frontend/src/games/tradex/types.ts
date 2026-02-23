export type OrderSide = "long" | "short";
export type PositionStatus = "open" | "closed" | "liquidated";
export type AssetSymbol = "XLM" | "BTC" | "ETH";
export type Leverage = 2 | 5 | 10;
export type TimeInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  id: string;
  asset: AssetSymbol;
  side: OrderSide;
  leverage: Leverage;
  entryPrice: number;
  quantity: number;
  margin: number;
  liquidationPrice: number;
  openedAt: number;
  stopLoss?: number;
  takeProfit?: number;
  status: PositionStatus;
  closedAt?: number;
  closePrice?: number;
  pnl?: number;
}

export interface Trade {
  id: string;
  positionId: string;
  asset: AssetSymbol;
  side: OrderSide;
  leverage: Leverage;
  entryPrice: number;
  closePrice: number;
  quantity: number;
  margin: number;
  pnl: number;
  pnlPercent: number;
  openedAt: number;
  closedAt: number;
  result: "profit" | "loss" | "liquidated";
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

export interface AssetInfo {
  symbol: AssetSymbol;
  name: string;
  binanceSymbol: string;
  coingeckoId: string;
  currentPrice: number;
  change24h: number;
}

export interface PlayerLevel {
  level: number;
  title: string;
  xpRequired: number;
  maxLeverage: Leverage;
}

export const LEVELS: PlayerLevel[] = [
  // Novice tier (1-5): 2x leverage, easy patterns only
  { level: 1,  title: "Observer",           xpRequired: 0,      maxLeverage: 2 },
  { level: 2,  title: "Paper Trader",       xpRequired: 50,     maxLeverage: 2 },
  { level: 3,  title: "Rookie",             xpRequired: 120,    maxLeverage: 2 },
  { level: 4,  title: "Student",            xpRequired: 220,    maxLeverage: 2 },
  { level: 5,  title: "Apprentice",         xpRequired: 350,    maxLeverage: 2 },
  // Trader tier (6-15): 5x leverage, medium patterns, RSI/MACD unlocked
  { level: 6,  title: "Trader",             xpRequired: 520,    maxLeverage: 5 },
  { level: 7,  title: "Swing Trader",       xpRequired: 750,    maxLeverage: 5 },
  { level: 8,  title: "Day Trader",         xpRequired: 1050,   maxLeverage: 5 },
  { level: 9,  title: "Analyst",            xpRequired: 1400,   maxLeverage: 5 },
  { level: 10, title: "Strategist",         xpRequired: 1850,   maxLeverage: 5 },
  { level: 11, title: "Chart Reader",       xpRequired: 2400,   maxLeverage: 5 },
  { level: 12, title: "Trend Follower",     xpRequired: 3050,   maxLeverage: 5 },
  { level: 13, title: "Pattern Trader",     xpRequired: 3800,   maxLeverage: 5 },
  { level: 14, title: "Risk Manager",       xpRequired: 4800,   maxLeverage: 5 },
  { level: 15, title: "Market Veteran",     xpRequired: 6000,   maxLeverage: 5 },
  // Pro tier (16-25): 10x leverage, hard patterns, all indicators
  { level: 16, title: "Professional",       xpRequired: 7500,   maxLeverage: 10 },
  { level: 17, title: "Chart Wizard",       xpRequired: 9500,   maxLeverage: 10 },
  { level: 18, title: "Market Maker",       xpRequired: 12000,  maxLeverage: 10 },
  { level: 19, title: "Alpha Seeker",       xpRequired: 15000,  maxLeverage: 10 },
  { level: 20, title: "Whale Whisperer",    xpRequired: 18500,  maxLeverage: 10 },
  { level: 21, title: "Volatility Tamer",   xpRequired: 22500,  maxLeverage: 10 },
  { level: 22, title: "Edge Hunter",        xpRequired: 27000,  maxLeverage: 10 },
  { level: 23, title: "Portfolio Master",   xpRequired: 31500,  maxLeverage: 10 },
  { level: 24, title: "Risk Architect",     xpRequired: 35500,  maxLeverage: 10 },
  { level: 25, title: "Alpha Hunter",       xpRequired: 37800,  maxLeverage: 10 },
  // Master tier (26-30): 10x leverage, custom features
  { level: 26, title: "Grandmaster",        xpRequired: 43800,  maxLeverage: 10 },
  { level: 27, title: "Stellar Sage",       xpRequired: 50500,  maxLeverage: 10 },
  { level: 28, title: "Market Oracle",      xpRequired: 58000,  maxLeverage: 10 },
  { level: 29, title: "ZK Legend",          xpRequired: 66000,  maxLeverage: 10 },
  { level: 30, title: "Tradex Titan",       xpRequired: 75500,  maxLeverage: 10 },
];

export interface Achievement {
  id: string;
  name: string;
  description: string;
  xpReward: number;
  condition: string;
  unlocked: boolean;
  unlockedAt?: number;
}

export const ACHIEVEMENTS: Omit<Achievement, "unlocked" | "unlockedAt">[] = [
  {
    id: "first_blood",
    name: "First Blood",
    description: "Complete your first trade",
    xpReward: 25,
    condition: "totalTrades >= 1",
  },
  {
    id: "winning_streak",
    name: "Winning Streak",
    description: "5 profitable trades in a row",
    xpReward: 50,
    condition: "winStreak >= 5",
  },
  {
    id: "diamond_hands",
    name: "Diamond Hands",
    description: "Hold a position for 10+ minutes",
    xpReward: 30,
    condition: "longestHold >= 600000",
  },
  {
    id: "liquidation_survivor",
    name: "Liquidation Survivor",
    description: "Close before liquidation 3 times",
    xpReward: 40,
    condition: "nearLiquidationCloses >= 3",
  },
  {
    id: "ten_trades",
    name: "Getting Started",
    description: "Complete 10 trades",
    xpReward: 35,
    condition: "totalTrades >= 10",
  },
  {
    id: "profitable_session",
    name: "In The Green",
    description: "End a session with positive P&L",
    xpReward: 45,
    condition: "totalPnl > 0",
  },
  {
    id: "badge_collector",
    name: "Badge Collector",
    description: "Mint your first badge on-chain",
    xpReward: 50,
    condition: "badgeMinted",
  },
  {
    id: "risk_manager",
    name: "Risk Manager",
    description: "5 consecutive trades using stop-loss",
    xpReward: 40,
    condition: "consecutiveSlTrades >= 5",
  },
  {
    id: "good_rr",
    name: "Smart Reward",
    description: "3 trades closed at 2:1+ risk-reward ratio",
    xpReward: 45,
    condition: "goodRrTrades >= 3",
  },
  {
    id: "drawdown_survivor",
    name: "Drawdown Survivor",
    description: "Recover from a 4%+ drawdown",
    xpReward: 50,
    condition: "drawdownRecovery",
  },
  {
    id: "fifty_trades",
    name: "Half Century",
    description: "Complete 50 trades",
    xpReward: 60,
    condition: "totalTrades >= 50",
  },
  {
    id: "century_trader",
    name: "Century Trader",
    description: "Complete 100 trades",
    xpReward: 100,
    condition: "totalTrades >= 100",
  },
  {
    id: "iron_streak",
    name: "Iron Streak",
    description: "10 profitable trades in a row",
    xpReward: 75,
    condition: "winStreak >= 10",
  },
  // Education module achievements
  {
    id: "pattern_novice",
    name: "Pattern Spotter",
    description: "Identify 10 patterns correctly",
    xpReward: 30,
    condition: "patternCorrect >= 10",
  },
  {
    id: "pattern_master",
    name: "Pattern Master",
    description: "25 correct in a row (pattern streak)",
    xpReward: 75,
    condition: "patternStreak >= 25",
  },
  {
    id: "prediction_novice",
    name: "Market Oracle",
    description: "Make 10 correct predictions",
    xpReward: 30,
    condition: "predictionCorrect >= 10",
  },
  {
    id: "prediction_master",
    name: "Crystal Ball",
    description: "80%+ credibility score (min 20 predictions)",
    xpReward: 75,
    condition: "credibilityScore >= 80",
  },
  {
    id: "all_rounder",
    name: "Renaissance Trader",
    description: "Complete 10+ challenges in each module",
    xpReward: 50,
    condition: "allModules >= 10",
  },
];

// Badge definitions (on-chain NFT badges via Soroban) -- matches backend domain/types.ts
export interface BadgeDef {
  id: string;
  name: string;
  type: number;
  threshold: number;
  stat: string;
}

export const BADGE_DEFS: BadgeDef[] = [
  // Level badges (types 0-9) -- check total_xp
  { id: "level_1", name: "Observer", type: 0, threshold: 0, stat: "total_xp" },
  {
    id: "level_2",
    name: "Rookie Trader",
    type: 1,
    threshold: 100,
    stat: "total_xp",
  },
  {
    id: "level_3",
    name: "Apprentice",
    type: 2,
    threshold: 300,
    stat: "total_xp",
  },
  {
    id: "level_4",
    name: "Swing Trader",
    type: 3,
    threshold: 600,
    stat: "total_xp",
  },
  {
    id: "level_5",
    name: "Day Trader",
    type: 4,
    threshold: 1000,
    stat: "total_xp",
  },
  {
    id: "level_6",
    name: "Chart Wizard",
    type: 5,
    threshold: 1600,
    stat: "total_xp",
  },
  {
    id: "level_7",
    name: "Market Maker",
    type: 6,
    threshold: 2500,
    stat: "total_xp",
  },
  {
    id: "level_8",
    name: "Whale Whisperer",
    type: 7,
    threshold: 4000,
    stat: "total_xp",
  },
  {
    id: "level_9",
    name: "Alpha Hunter",
    type: 8,
    threshold: 6000,
    stat: "total_xp",
  },
  {
    id: "level_10",
    name: "ZK Grandmaster",
    type: 9,
    threshold: 10000,
    stat: "total_xp",
  },
  // Achievement badges (types 10-19)
  {
    id: "first_blood",
    name: "First Blood",
    type: 10,
    threshold: 1,
    stat: "total_trades",
  },
  {
    id: "winning_streak",
    name: "Winning Streak",
    type: 11,
    threshold: 5,
    stat: "win_streak",
  },
  {
    id: "diamond_hands",
    name: "Diamond Hands",
    type: 12,
    threshold: 600000,
    stat: "longest_hold_ms",
  },
  {
    id: "liquidation_survivor",
    name: "Liquidation Survivor",
    type: 13,
    threshold: 3,
    stat: "near_liq_closes",
  },
  {
    id: "ten_trades",
    name: "Getting Started",
    type: 14,
    threshold: 10,
    stat: "total_trades",
  },
  {
    id: "profitable_session",
    name: "In The Green",
    type: 15,
    threshold: 1,
    stat: "profitable_sessions",
  },
  {
    id: "badge_collector",
    name: "Badge Collector",
    type: 16,
    threshold: 1,
    stat: "verified_sessions",
  },
  {
    id: "fifty_trades",
    name: "Half Century",
    type: 17,
    threshold: 50,
    stat: "total_trades",
  },
  {
    id: "century_trader",
    name: "Century Trader",
    type: 18,
    threshold: 100,
    stat: "total_trades",
  },
  {
    id: "iron_streak",
    name: "Iron Streak",
    type: 19,
    threshold: 10,
    stat: "win_streak",
  },
  // Education module badges (types 20-24)
  {
    id: "pattern_novice",
    name: "Pattern Spotter",
    type: 20,
    threshold: 10,
    stat: "pattern_correct",
  },
  {
    id: "pattern_master",
    name: "Pattern Master",
    type: 21,
    threshold: 25,
    stat: "pattern_streak",
  },
  {
    id: "prediction_novice",
    name: "Market Oracle",
    type: 22,
    threshold: 10,
    stat: "prediction_correct",
  },
  {
    id: "prediction_master",
    name: "Crystal Ball",
    type: 23,
    threshold: 80,
    stat: "credibility_score",
  },
  {
    id: "all_rounder",
    name: "Renaissance Trader",
    type: 24,
    threshold: 10,
    stat: "total_trades",
  },
];

// Options trading types
export type OptionType = "call" | "put";
export type OptionExpiry = "1m" | "5m" | "15m" | "1h";
export type OptionStatus = "active" | "settled" | "expired";

export interface OptionContract {
  id: string;
  asset: AssetSymbol;
  optionType: OptionType;
  strikePrice: number;
  spotPriceAtOpen: number;
  premium: number;
  expiry: OptionExpiry;
  expiresAt: number;
  openedAt: number;
  status: OptionStatus;
  settlementPrice?: number;
  pnl?: number;
  settledAt?: number;
}

export interface OptionTrade {
  id: string;
  optionId: string;
  asset: AssetSymbol;
  optionType: OptionType;
  strikePrice: number;
  premium: number;
  expiry: OptionExpiry;
  spotPriceAtOpen: number;
  settlementPrice: number;
  pnl: number;
  openedAt: number;
  settledAt: number;
  result: "itm" | "otm"; // in-the-money or out-of-the-money
}

export const EXPIRY_DURATIONS: Record<OptionExpiry, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
};

// Payout multiplier for ITM options (simplified)
export const OPTION_PAYOUT_MULTIPLIER = 1.8;

export const STARTING_BALANCE = 10_000;
export const LIQUIDATION_THRESHOLD = 0.9;
export const MAX_POSITIONS = 5;
export const MAX_OPTIONS = 5;

export const SUPPORTED_ASSETS: AssetInfo[] = [
  {
    symbol: "XLM",
    name: "Stellar Lumens",
    binanceSymbol: "XLMUSDT",
    coingeckoId: "stellar",
    currentPrice: 0,
    change24h: 0,
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    binanceSymbol: "BTCUSDT",
    coingeckoId: "bitcoin",
    currentPrice: 0,
    change24h: 0,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    binanceSymbol: "ETHUSDT",
    coingeckoId: "ethereum",
    currentPrice: 0,
    change24h: 0,
  },
];
