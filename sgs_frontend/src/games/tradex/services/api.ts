const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Tradex hub contract ID (from SGS config or env)
export const TRADEX_HUB_CONTRACT_ID =
  import.meta.env.VITE_TRADEX_HUB_CONTRACT_ID || '';

function getToken(): string | null {
  return sessionStorage.getItem('tradex_token');
}

export function setToken(token: string): void {
  sessionStorage.setItem('tradex_token', token);
}

export function clearToken(): void {
  sessionStorage.removeItem('tradex_token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `API error: ${res.status}`);
  }

  return res.json();
}

// ── Auth ──

export const authApi = {
  devLogin(walletAddress: string) {
    return request<{ token: string; player: PlayerProfile }>('POST', '/api/auth/dev-login', {
      wallet_address: walletAddress,
    });
  },

  challenge(walletAddress: string) {
    return request<{ challenge: string }>('POST', '/api/auth/challenge', {
      wallet_address: walletAddress,
    });
  },

  verify(walletAddress: string, signature: string) {
    return request<{ token: string; player: PlayerProfile }>('POST', '/api/auth/verify', {
      wallet_address: walletAddress,
      signature,
    });
  },
};

// ── Player ──

export const playerApi = {
  getProfile() {
    return request<PlayerProfile>('GET', '/api/player/profile');
  },

  updateProfile(displayName: string) {
    return request<PlayerProfile>('PATCH', '/api/player/profile', {
      display_name: displayName,
    });
  },
};

// ── Sessions ──

export const sessionApi = {
  start() {
    return request<{ session: SessionData }>('POST', '/api/session/start');
  },

  getCurrent() {
    return request<CurrentSessionData>('GET', '/api/session/current');
  },

  end() {
    return request<SessionEndResult>('POST', '/api/session/end');
  },

  reset() {
    return request<{ cooldown_until: number; xp_penalty: number }>('POST', '/api/session/reset');
  },

  getHistory(limit = 20, offset = 0) {
    return request<{ sessions: SessionData[] }>('GET', `/api/session/history?limit=${limit}&offset=${offset}`);
  },
};

// ── Trading ──

export const tradeApi = {
  open(params: { asset: string; side: string; leverage: number; margin: number; stop_loss?: number; take_profit?: number }) {
    return request<TradeOpenResult>('POST', '/api/trade/open', params);
  },

  close(positionId: string) {
    return request<TradeCloseResult>('POST', '/api/trade/close', { position_id: positionId });
  },
};

// ── Options ──

export const optionsApi = {
  getStrikes(asset: string) {
    return request<{ asset: string; spot_price: number; strikes: number[] }>('GET', `/api/options/strikes?asset=${asset}`);
  },

  open(params: {
    asset: string;
    option_type: string;
    strike_price: number;
    expiry: string;
    premium: number;
  }) {
    return request<{ option: OptionContractData; balance: number }>('POST', '/api/options/open', params);
  },
};

// ── Leaderboard ──

export const leaderboardApi = {
  get(period: 'weekly' | 'all_time' = 'all_time') {
    return request<{ entries: LeaderboardEntryData[]; period: string }>('GET', `/api/leaderboard?period=${period}`);
  },
};

// ── Badges ──

export const badgeApi = {
  getEligible() {
    return request<{ badges: BadgeEligibleData[] }>('GET', '/api/badges/eligible');
  },

  prepare(badgeId: string) {
    return request<BadgePrepareResult>('POST', '/api/badges/prepare', { badge_id: badgeId });
  },

  mint(badgeId: string) {
    return request<BadgeMintResult>('POST', '/api/badges/mint', { badge_id: badgeId });
  },

  getMine() {
    return request<{ badges: BadgeData[] }>('GET', '/api/badges/mine');
  },
};

// ── Patterns (education) ──

export const patternApi = {
  getChallenge() {
    return request<PatternChallengeData>('POST', '/api/patterns/challenge');
  },

  submitAnswer(challengeId: number, answer: string, timeMs: number) {
    return request<PatternAnswerResult>('POST', '/api/patterns/answer', {
      challenge_id: challengeId,
      answer,
      time_ms: timeMs,
    });
  },

  getStats() {
    return request<PatternStatsData>('GET', '/api/patterns/stats');
  },
};

// ── Predictions (education) ──

export const predictionApi = {
  getChallenge(asset?: string, timeframe?: string) {
    return request<PredictionChallengeData>('POST', '/api/predictions/challenge', {
      ...(asset && { asset }),
      ...(timeframe && { timeframe }),
    });
  },

  submitAnswer(challengeId: number, direction: 'up' | 'down' | 'sideways', magnitude?: string) {
    return request<PredictionAnswerResult>('POST', '/api/predictions/answer', {
      challenge_id: challengeId,
      direction,
      ...(magnitude && { magnitude }),
    });
  },

  getStats() {
    return request<PredictionStatsData>('GET', '/api/predictions/stats');
  },
};

// ── Prices ──

export const pricesApi = {
  getCurrent(assets?: string[]) {
    const params = assets ? `?assets=${assets.join(',')}` : '';
    return request<{ prices: Record<string, number>; timestamp: number }>('GET', `/api/prices/current${params}`);
  },

  getCandles(asset: string, interval = '1m', limit = 300) {
    return request<{ candles: CandleData[] }>('GET', `/api/prices/candles?asset=${asset}&interval=${interval}&limit=${limit}`);
  },
};

// ── Shared API types ──

export interface PlayerProfile {
  id: number;
  wallet_address: string;
  display_name: string;
  xp: number;
  level: number;
  levelInfo: { level: number; title: string; xpRequired: number; maxLeverage: number };
  achievements: string[];
  win_streak: number;
  longest_hold_ms: number;
  near_liq_closes: number;
  total_sessions: number;
  total_trades: number;
  total_pnl: number;
  best_pnl_pct: number;
  // Education stats
  pattern_correct: number;
  pattern_total: number;
  pattern_streak: number;
  pattern_best_streak: number;
  prediction_correct: number;
  prediction_total: number;
  prediction_streak: number;
  credibility_score: number;
}

export interface SessionData {
  id: number;
  player_id: number;
  status: string;
  starting_balance: number;
  ending_balance: number | null;
  total_pnl: number;
  trade_count: number;
  option_count: number;
  xp_earned: number;
  started_at: number;
  ended_at: number | null;
}

export interface PositionData {
  id: string;
  session_id: number;
  player_id: number;
  asset: string;
  side: string;
  leverage: number;
  entry_price: number;
  quantity: number;
  margin: number;
  liquidation_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  close_price: number | null;
  pnl: number | null;
  opened_at: number;
  closed_at: number | null;
}

export interface TradeData {
  id: string;
  position_id: string;
  asset: string;
  side: string;
  leverage: number;
  entry_price: number;
  close_price: number;
  quantity: number;
  margin: number;
  pnl: number;
  pnl_percent: number;
  result: string;
  opened_at: number;
  closed_at: number;
}

export interface PortfolioData {
  balance: number;
  startingBalance: number;
  lockedMargin: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
}

export interface CurrentSessionData {
  session: SessionData;
  positions: PositionData[];
  trades: TradeData[];
  portfolio: PortfolioData;
  balance: number;
}

export interface TradeOpenResult {
  position: PositionData;
  balance: number;
  portfolio: PortfolioData;
  xpAwarded: number;
}

export interface TradeCloseResult {
  trade: TradeData;
  balance: number;
  portfolio: PortfolioData;
  xpAwarded: number;
  achievements: string[];
}

export interface SessionEndResult {
  session: SessionData;
  trades: TradeData[];
  finalBalance: number;
  totalPnl: number;
  xpEarned: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OptionContractData {
  id: string;
  asset: string;
  option_type: string;
  strike_price: number;
  spot_at_open: number;
  premium: number;
  expiry: string;
  expires_at: number;
  status: string;
}

export interface LeaderboardEntryData {
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
}

export interface BadgeData {
  player_id: number;
  badge_id: string;
  badge_type: number;
  proof_hex: string | null;
  public_inputs_hex: string | null;
  soroban_tx_hash: string | null;
  minted_at: number;
}

export interface BadgeEligibleData {
  id: string;
  name: string;
  type: number;
  threshold: number;
  stat: string;
  eligible: boolean;
  minted: boolean;
}

export interface BadgePrepareResult {
  proof_hex: string;
  public_inputs_hex: string;
  badge_id: string;
  badge_type: number;
  threshold: number;
}

export interface BadgeMintResult {
  badge_id: string;
  soroban_tx_hash: string;
  already_minted: boolean;
}

// ── Education module types ──

export interface PatternChallengeData {
  challenge_id: number;
  candles: CandleData[];
  asset: string;
  difficulty: string;
  highlight_start: number;
  highlight_end: number;
  options: string[];
}

export interface PatternAnswerResult {
  correct: boolean;
  correct_answer: string;
  description: string;
  xp_awarded: number;
  streak: number;
  streak_multiplier: number;
  balance_change: number;
}

export interface PatternStatsData {
  total: number;
  correct: number;
  accuracy: number;
  current_streak: number;
  best_streak: number;
}

export interface PredictionChallengeData {
  challenge_id: number;
  asset: string;
  timeframe: string;
  candles: CandleData[];
  cutoff_time: number;
}

export interface PredictionAnswerResult {
  correct: boolean;
  actual_direction: 'up' | 'down' | 'sideways';
  price_change_pct: number;
  magnitude_correct: boolean;
  hidden_candles: CandleData[];
  xp_awarded: number;
  streak: number;
  streak_multiplier: number;
  credibility_score: number;
  bet_amount: number;
  bet_pnl: number;
  balance_change: number;
}

export interface PredictionStatsData {
  total: number;
  correct: number;
  accuracy: number;
  current_streak: number;
  credibility_score: number;
}

export interface LeaderboardEntryDataExtended extends LeaderboardEntryData {
  sharpe_ratio: number;
}
