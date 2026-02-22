import { getDb } from '../connection';
import type { PlayerRow, AuthTokenRow } from '../../domain/types';

export const playerRepo = {
  findByWallet(walletAddress: string): PlayerRow | null {
    const db = getDb();
    return db.query('SELECT * FROM players WHERE wallet_address = ?').get(walletAddress) as PlayerRow | null;
  },

  findById(id: number): PlayerRow | null {
    const db = getDb();
    return db.query('SELECT * FROM players WHERE id = ?').get(id) as PlayerRow | null;
  },

  create(walletAddress: string, displayName?: string): PlayerRow {
    const db = getDb();
    const name = displayName || `Trader_${walletAddress.slice(0, 8)}`;
    return db.query(
      'INSERT INTO players (wallet_address, display_name, created_at) VALUES (?, ?, ?) RETURNING *',
    ).get(walletAddress, name, Date.now()) as PlayerRow;
  },

  updateDisplayName(id: number, displayName: string): void {
    const db = getDb();
    db.query('UPDATE players SET display_name = ? WHERE id = ?').run(displayName, id);
  },

  addXp(id: number, amount: number): PlayerRow {
    const db = getDb();
    return db.query(
      'UPDATE players SET xp = xp + ? WHERE id = ? RETURNING *',
    ).get(amount, id) as PlayerRow;
  },

  setLevel(id: number, level: number): void {
    const db = getDb();
    db.query('UPDATE players SET level = ? WHERE id = ?').run(level, id);
  },

  updateStats(id: number, updates: Partial<Pick<PlayerRow,
    'win_streak' | 'longest_hold_ms' | 'near_liq_closes' |
    'total_sessions' | 'total_trades' | 'total_pnl' | 'best_pnl_pct' |
    'pattern_correct' | 'pattern_total' | 'pattern_streak' | 'pattern_best_streak' |
    'prediction_correct' | 'prediction_total' | 'prediction_streak' | 'credibility_score' |
    'xp' | 'reset_cooldown_until' | 'total_resets' | 'sl_placements' | 'consecutive_sl_trades' | 'good_rr_trades'
  >>): void {
    const db = getDb();
    if (updates.win_streak !== undefined) {
      db.query('UPDATE players SET win_streak = ? WHERE id = ?').run(updates.win_streak, id);
    }
    if (updates.longest_hold_ms !== undefined) {
      db.query('UPDATE players SET longest_hold_ms = MAX(longest_hold_ms, ?) WHERE id = ?').run(updates.longest_hold_ms, id);
    }
    if (updates.near_liq_closes !== undefined) {
      db.query('UPDATE players SET near_liq_closes = ? WHERE id = ?').run(updates.near_liq_closes, id);
    }
    if (updates.total_sessions !== undefined) {
      db.query('UPDATE players SET total_sessions = total_sessions + 1 WHERE id = ?').run(id);
    }
    if (updates.total_trades !== undefined) {
      db.query('UPDATE players SET total_trades = total_trades + 1 WHERE id = ?').run(id);
    }
    if (updates.total_pnl !== undefined) {
      db.query('UPDATE players SET total_pnl = total_pnl + ? WHERE id = ?').run(updates.total_pnl, id);
    }
    if (updates.best_pnl_pct !== undefined) {
      db.query('UPDATE players SET best_pnl_pct = MAX(best_pnl_pct, ?) WHERE id = ?').run(updates.best_pnl_pct, id);
    }
    // Education stats
    if (updates.pattern_correct !== undefined) {
      db.query('UPDATE players SET pattern_correct = ? WHERE id = ?').run(updates.pattern_correct, id);
    }
    if (updates.pattern_total !== undefined) {
      db.query('UPDATE players SET pattern_total = ? WHERE id = ?').run(updates.pattern_total, id);
    }
    if (updates.pattern_streak !== undefined) {
      db.query('UPDATE players SET pattern_streak = ? WHERE id = ?').run(updates.pattern_streak, id);
    }
    if (updates.pattern_best_streak !== undefined) {
      db.query('UPDATE players SET pattern_best_streak = MAX(COALESCE(pattern_best_streak, 0), ?) WHERE id = ?').run(updates.pattern_best_streak, id);
    }
    if (updates.prediction_correct !== undefined) {
      db.query('UPDATE players SET prediction_correct = ? WHERE id = ?').run(updates.prediction_correct, id);
    }
    if (updates.prediction_total !== undefined) {
      db.query('UPDATE players SET prediction_total = ? WHERE id = ?').run(updates.prediction_total, id);
    }
    if (updates.prediction_streak !== undefined) {
      db.query('UPDATE players SET prediction_streak = ? WHERE id = ?').run(updates.prediction_streak, id);
    }
    if (updates.credibility_score !== undefined) {
      db.query('UPDATE players SET credibility_score = ? WHERE id = ?').run(updates.credibility_score, id);
    }
    // Risk management stats
    if (updates.xp !== undefined) {
      db.query('UPDATE players SET xp = ? WHERE id = ?').run(updates.xp, id);
    }
    if (updates.reset_cooldown_until !== undefined) {
      db.query('UPDATE players SET reset_cooldown_until = ? WHERE id = ?').run(updates.reset_cooldown_until, id);
    }
    if (updates.total_resets !== undefined) {
      db.query('UPDATE players SET total_resets = ? WHERE id = ?').run(updates.total_resets, id);
    }
    if (updates.sl_placements !== undefined) {
      db.query('UPDATE players SET sl_placements = ? WHERE id = ?').run(updates.sl_placements, id);
    }
    if (updates.consecutive_sl_trades !== undefined) {
      db.query('UPDATE players SET consecutive_sl_trades = ? WHERE id = ?').run(updates.consecutive_sl_trades, id);
    }
    if (updates.good_rr_trades !== undefined) {
      db.query('UPDATE players SET good_rr_trades = ? WHERE id = ?').run(updates.good_rr_trades, id);
    }
  },

  incrementTrades(id: number): void {
    const db = getDb();
    db.query('UPDATE players SET total_trades = total_trades + 1 WHERE id = ?').run(id);
  },

  incrementSessions(id: number): void {
    const db = getDb();
    db.query('UPDATE players SET total_sessions = total_sessions + 1 WHERE id = ?').run(id);
  },

  // ── Auth tokens ──
  createToken(playerId: number, token: string, expiresAt: number): void {
    const db = getDb();
    db.query('INSERT INTO auth_tokens (token, player_id, expires_at) VALUES (?, ?, ?)').run(token, playerId, expiresAt);
  },

  findToken(token: string): AuthTokenRow | null {
    const db = getDb();
    return db.query('SELECT * FROM auth_tokens WHERE token = ? AND expires_at > ?').get(token, Date.now()) as AuthTokenRow | null;
  },

  deleteExpiredTokens(): void {
    const db = getDb();
    db.query('DELETE FROM auth_tokens WHERE expires_at <= ?').run(Date.now());
  },

  // ── Achievements ──
  getAchievements(playerId: number): string[] {
    const db = getDb();
    const rows = db.query('SELECT achievement_id FROM player_achievements WHERE player_id = ?').all(playerId) as { achievement_id: string }[];
    return rows.map((r) => r.achievement_id);
  },

  addAchievement(playerId: number, achievementId: string, xpReward: number): boolean {
    const db = getDb();
    const result = db.query(
      'INSERT OR IGNORE INTO player_achievements (player_id, achievement_id, xp_reward, unlocked_at) VALUES (?, ?, ?, ?)',
    ).run(playerId, achievementId, xpReward, Date.now());
    return result.changes > 0;
  },
};
