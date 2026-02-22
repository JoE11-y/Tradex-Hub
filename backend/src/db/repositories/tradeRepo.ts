import { getDb } from '../connection';
import type { TradeRow } from '../../domain/types';

export const tradeRepo = {
  create(trade: TradeRow): TradeRow {
    const db = getDb();
    return db.query(
      'INSERT INTO trades (id, position_id, session_id, player_id, asset, side, leverage, entry_price, close_price, quantity, margin, pnl, pnl_percent, result, opened_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
    ).get(
      trade.id, trade.position_id, trade.session_id, trade.player_id, trade.asset, trade.side,
      trade.leverage, trade.entry_price, trade.close_price, trade.quantity, trade.margin,
      trade.pnl, trade.pnl_percent, trade.result, trade.opened_at, trade.closed_at,
    ) as TradeRow;
  },

  findBySession(sessionId: number): TradeRow[] {
    const db = getDb();
    return db.query(
      'SELECT * FROM trades WHERE session_id = ? ORDER BY closed_at DESC, id ASC',
    ).all(sessionId) as TradeRow[];
  },

  findByPlayer(playerId: number, limit: number = 50): TradeRow[] {
    const db = getDb();
    return db.query(
      'SELECT * FROM trades WHERE player_id = ? ORDER BY closed_at DESC LIMIT ?',
    ).all(playerId, limit) as TradeRow[];
  },

  countBySession(sessionId: number): number {
    const db = getDb();
    const row = db.query('SELECT COUNT(*) as count FROM trades WHERE session_id = ?').get(sessionId) as { count: number };
    return row.count;
  },
};
