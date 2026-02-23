export const migrations: string[] = [
  `CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL DEFAULT 'Trader',
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    win_streak INTEGER NOT NULL DEFAULT 0,
    longest_hold_ms INTEGER NOT NULL DEFAULT 0,
    near_liq_closes INTEGER NOT NULL DEFAULT 0,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_trades INTEGER NOT NULL DEFAULT 0,
    total_pnl REAL NOT NULL DEFAULT 0,
    best_pnl_pct REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS auth_tokens (
    token TEXT PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    expires_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS trading_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id),
    status TEXT NOT NULL DEFAULT 'active',
    starting_balance REAL NOT NULL DEFAULT 10000,
    ending_balance REAL,
    total_pnl REAL NOT NULL DEFAULT 0,
    trade_count INTEGER NOT NULL DEFAULT 0,
    option_count INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    portfolio_root TEXT,
    proof_batch_id INTEGER,
    started_at INTEGER NOT NULL,
    ended_at INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES trading_sessions(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    asset TEXT NOT NULL,
    side TEXT NOT NULL,
    leverage INTEGER NOT NULL,
    entry_price REAL NOT NULL,
    quantity REAL NOT NULL,
    margin REAL NOT NULL,
    liquidation_price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    close_price REAL,
    pnl REAL,
    opened_at INTEGER NOT NULL,
    closed_at INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    position_id TEXT NOT NULL REFERENCES positions(id),
    session_id INTEGER NOT NULL REFERENCES trading_sessions(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    asset TEXT NOT NULL,
    side TEXT NOT NULL,
    leverage INTEGER NOT NULL,
    entry_price REAL NOT NULL,
    close_price REAL NOT NULL,
    quantity REAL NOT NULL,
    margin REAL NOT NULL,
    pnl REAL NOT NULL,
    pnl_percent REAL NOT NULL,
    result TEXT NOT NULL,
    opened_at INTEGER NOT NULL,
    closed_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS option_contracts (
    id TEXT PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES trading_sessions(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    asset TEXT NOT NULL,
    option_type TEXT NOT NULL,
    strike_price REAL NOT NULL,
    spot_at_open REAL NOT NULL,
    premium REAL NOT NULL,
    expiry TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    settlement_price REAL,
    pnl REAL,
    opened_at INTEGER NOT NULL,
    settled_at INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS option_trades (
    id TEXT PRIMARY KEY,
    option_id TEXT NOT NULL,
    session_id INTEGER NOT NULL REFERENCES trading_sessions(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    asset TEXT NOT NULL,
    option_type TEXT NOT NULL,
    strike_price REAL NOT NULL,
    premium REAL NOT NULL,
    expiry TEXT NOT NULL,
    spot_at_open REAL NOT NULL,
    settlement_price REAL NOT NULL,
    pnl REAL NOT NULL,
    opened_at INTEGER NOT NULL,
    settled_at INTEGER NOT NULL,
    result TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS player_achievements (
    player_id INTEGER NOT NULL REFERENCES players(id),
    achievement_id TEXT NOT NULL,
    xp_reward INTEGER NOT NULL,
    unlocked_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, achievement_id)
  )`,

  `CREATE TABLE IF NOT EXISTS proof_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES trading_sessions(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    trade_count INTEGER NOT NULL DEFAULT 0,
    batch_hash TEXT NOT NULL DEFAULT '',
    old_portfolio_root TEXT NOT NULL DEFAULT '',
    new_portfolio_root TEXT NOT NULL DEFAULT '',
    proof_hex TEXT,
    public_inputs TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    soroban_tx_hash TEXT,
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS leaderboard_cache (
    rank INTEGER NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players(id),
    wallet_address TEXT NOT NULL,
    display_name TEXT NOT NULL,
    level INTEGER NOT NULL,
    total_pnl REAL NOT NULL,
    best_pnl_pct REAL NOT NULL,
    total_trades INTEGER NOT NULL,
    xp INTEGER NOT NULL,
    zk_verified INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_positions_session ON positions(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_trades_session ON trades(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_option_contracts_session ON option_contracts(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_option_contracts_status_expires ON option_contracts(status, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_trading_sessions_player_status ON trading_sessions(player_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_tokens_player ON auth_tokens(player_id)`,

  // Migration: add attestation column to proof_batches
  `ALTER TABLE proof_batches ADD COLUMN attestation TEXT`,

  // B10: compound index for liquidation queries (findAllOpenByAsset)
  `CREATE INDEX IF NOT EXISTS idx_positions_asset_status ON positions(asset, status)`,

  // B11: index for leaderboard_cache lookups by player
  `CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_player ON leaderboard_cache(player_id)`,

  // Education module: pattern challenges
  `CREATE TABLE IF NOT EXISTS pattern_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id),
    pattern_id TEXT NOT NULL,
    answer TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    time_ms INTEGER NOT NULL,
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    streak_at_time INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pattern_challenges_player ON pattern_challenges(player_id)`,

  // Education module: prediction challenges
  `CREATE TABLE IF NOT EXISTS prediction_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id),
    asset TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    direction TEXT NOT NULL,
    actual_direction TEXT NOT NULL,
    price_change_pct REAL NOT NULL,
    is_correct INTEGER NOT NULL,
    magnitude_correct INTEGER NOT NULL DEFAULT 0,
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    streak_at_time INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_prediction_challenges_player ON prediction_challenges(player_id)`,

  // Education module: player stats columns
  `ALTER TABLE players ADD COLUMN pattern_correct INTEGER DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN pattern_total INTEGER DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN pattern_streak INTEGER DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN pattern_best_streak INTEGER DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN prediction_correct INTEGER DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN prediction_total INTEGER DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN prediction_streak INTEGER DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN credibility_score REAL DEFAULT 0`,

  // Paper trading enhancements
  `ALTER TABLE trading_sessions ADD COLUMN sharpe_ratio REAL DEFAULT 0`,
  `ALTER TABLE trading_sessions ADD COLUMN max_drawdown REAL DEFAULT 0`,

  // Badge tracking (local persistence for minted badges)
  `CREATE TABLE IF NOT EXISTS player_badges (
    player_id INTEGER NOT NULL REFERENCES players(id),
    badge_id TEXT NOT NULL,
    badge_type INTEGER NOT NULL,
    proof_hex TEXT,
    public_inputs_hex TEXT,
    soroban_tx_hash TEXT,
    minted_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, badge_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_player_badges_player ON player_badges(player_id)`,

  // Track starting XP for accurate session XP display
  `ALTER TABLE trading_sessions ADD COLUMN starting_xp INTEGER DEFAULT 0`,

  // Stop-loss / take-profit on positions
  `ALTER TABLE positions ADD COLUMN stop_loss REAL`,
  `ALTER TABLE positions ADD COLUMN take_profit REAL`,

  // Prediction betting columns
  `ALTER TABLE prediction_challenges ADD COLUMN bet_amount REAL DEFAULT 0`,
  `ALTER TABLE prediction_challenges ADD COLUMN bet_pnl REAL DEFAULT 0`,
  `ALTER TABLE prediction_challenges ADD COLUMN session_id INTEGER`,

  // Track prediction P/L on sessions
  `ALTER TABLE trading_sessions ADD COLUMN prediction_pnl REAL DEFAULT 0`,

  // Drawdown tracking on sessions
  `ALTER TABLE trading_sessions ADD COLUMN daily_high_balance REAL DEFAULT 0`,
  `ALTER TABLE trading_sessions ADD COLUMN drawdown_lockout_until INTEGER DEFAULT 0`,

  // NFT token_id from Soroban badge minting
  `ALTER TABLE player_badges ADD COLUMN nft_token_id INTEGER`,

  // Reset and risk management columns on players
  `ALTER TABLE players ADD COLUMN reset_cooldown_until INTEGER DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN total_resets INTEGER DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN sl_placements INTEGER DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN consecutive_sl_trades INTEGER DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN good_rr_trades INTEGER DEFAULT 0`,
];
