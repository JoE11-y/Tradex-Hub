import { getDb } from '../connection';
import type { SessionRow } from '../../domain/types';

export const sessionRepo = {
  findActiveByPlayer(playerId: number): SessionRow | null {
    const db = getDb();
    return db.query(
      "SELECT * FROM trading_sessions WHERE player_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1",
    ).get(playerId) as SessionRow | null;
  },

  findById(id: number): SessionRow | null {
    const db = getDb();
    return db.query('SELECT * FROM trading_sessions WHERE id = ?').get(id) as SessionRow | null;
  },

  create(playerId: number, startingBalance: number, startingXp: number = 0): SessionRow {
    const db = getDb();
    return db.query(
      "INSERT INTO trading_sessions (player_id, status, starting_balance, starting_xp, started_at) VALUES (?, 'active', ?, ?, ?) RETURNING *",
    ).get(playerId, startingBalance, startingXp, Date.now()) as SessionRow;
  },

  end(id: number, endingBalance: number, totalPnl: number, tradeCount: number, optionCount: number, xpEarned: number, sharpeRatio: number = 0, maxDrawdown: number = 0): SessionRow {
    const db = getDb();
    return db.query(
      "UPDATE trading_sessions SET status = 'ended', ending_balance = ?, total_pnl = ?, trade_count = ?, option_count = ?, xp_earned = ?, sharpe_ratio = ?, max_drawdown = ?, ended_at = ? WHERE id = ? RETURNING *",
    ).get(endingBalance, totalPnl, tradeCount, optionCount, xpEarned, sharpeRatio, maxDrawdown, Date.now(), id) as SessionRow;
  },

  incrementTradeCount(id: number): void {
    const db = getDb();
    db.query('UPDATE trading_sessions SET trade_count = trade_count + 1 WHERE id = ?').run(id);
  },

  incrementOptionCount(id: number): void {
    const db = getDb();
    db.query('UPDATE trading_sessions SET option_count = option_count + 1 WHERE id = ?').run(id);
  },

  addXpEarned(id: number, amount: number): void {
    const db = getDb();
    db.query('UPDATE trading_sessions SET xp_earned = xp_earned + ? WHERE id = ?').run(amount, id);
  },

  findStaleActive(maxAgeMs: number): SessionRow[] {
    const db = getDb();
    const cutoff = Date.now() - maxAgeMs;
    return db.query(
      "SELECT * FROM trading_sessions WHERE status = 'active' AND started_at < ?",
    ).all(cutoff) as SessionRow[];
  },

  getHistory(playerId: number, limit: number = 20, offset: number = 0): SessionRow[] {
    const db = getDb();
    return db.query(
      'SELECT * FROM trading_sessions WHERE player_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?',
    ).all(playerId, limit, offset) as SessionRow[];
  },
};
