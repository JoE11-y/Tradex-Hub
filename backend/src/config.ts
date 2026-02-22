export const CONFIG = {
  PORT: parseInt(process.env.PORT || "3001", 10),
  DB_PATH: process.env.DB_PATH || "./tradex.db",
  BINANCE_BASE: "https://api.binance.com/api/v3",
  PRICE_POLL_INTERVAL_MS: 2000,
  CANDLE_CACHE_TTL_MS: 5_000,
  LEADERBOARD_REBUILD_INTERVAL_MS: 30_000,
  OPTION_CHECK_INTERVAL_MS: 1000,
  AUTH_TOKEN_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
  DEV_MODE: process.env.NODE_ENV !== "production",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",

  // Trading constants
  STARTING_BALANCE: 10_000,
  TRADING_FEE_PCT: 0, // Disabled -- this is a game, not a real exchange
  LIQUIDATION_THRESHOLD: 0.9,
  MAX_POSITIONS: 5,
  MAX_OPTIONS: 5,
  OPTION_PAYOUT_MULTIPLIER: 1.8,
  VALID_LEVERAGES: [2, 5, 10] as const,
  VALID_ASSETS: ["XLM", "BTC", "ETH"] as const,

  // XP awards (education is "safe" XP source, trading is high-risk)
  XP_TRADE_EXECUTE: 3,
  XP_TRADE_PROFIT: 8,
  XP_NEAR_LIQUIDATION: 15,
  XP_PATTERN_CORRECT: 12,
  XP_PATTERN_SPEED_BONUS: 5,
  XP_PREDICTION_CORRECT: 10,
  XP_PREDICTION_MAGNITUDE_BONUS: 5,
  XP_SL_PLACEMENT: 5,
  XP_GOOD_RR: 8,
  XP_PREDICTION_STREAK_BONUS: 3,
  PATTERN_SPEED_THRESHOLD_MS: 10_000,

  // Education balance bonuses
  PATTERN_ENTRY_FEE: 50,
  PATTERN_CORRECT_BALANCE_BONUS: 25,
  PREDICTION_CORRECT_BALANCE_BONUS: 15,

  // Risk management
  DAILY_DRAWDOWN_LIMIT_PCT: 0.05,
  RESET_XP_PENALTY_PCT: 0.10,
  RESET_COOLDOWN_MS: 300_000,

  // Prediction settings
  PREDICTION_VISIBLE_RATIO: 0.8,
  PREDICTION_CACHE_SIZE: 100,
  PREDICTION_MIN_MONTHS_AGO: 6,
  PREDICTION_MAX_MONTHS_AGO: 24,

  // ZK proof pipeline (badge proofs only)
  BADGE_CIRCUIT_DIR: process.env.BADGE_CIRCUIT_DIR || "../circuits/badge_proof",

  // Soroban contract
  TRADEX_HUB_CONTRACT_ID:
    process.env.TRADEX_HUB_CONTRACT_ID ||
    "CB5WCIID2H7Z7FNBBMJJ3OKEUDYFHQ7IYUMITIXKPLATTDE6IASGI2FJ",
  SERVER_SECRET_KEY:
    process.env.SERVER_SECRET_KEY ||
    "SC4FILSKVUOCDYUSIN3MGDPHLIAH7DYM7WJA2XNSS2MGF5Y6ECTM45OG",
  STELLAR_NETWORK_PASSPHRASE:
    process.env.STELLAR_NETWORK_PASSPHRASE ||
    "Test SDF Network ; September 2015",
  STELLAR_RPC_URL:
    process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
} as const;

export const SYMBOL_MAP: Record<string, string> = {
  XLM: "XLMUSDT",
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

export const EXPIRY_DURATIONS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
};
