import { getDb } from '../connection';
import type { PositionRow, AssetSymbol } from '../../domain/types';

export const positionRepo = {
  findById(id: string): PositionRow | null {
    const db = getDb();
    return db.query('SELECT * FROM positions WHERE id = ?').get(id) as PositionRow | null;
  },

  findOpenBySession(sessionId: number): PositionRow[] {
    const db = getDb();
    return db.query(
      "SELECT * FROM positions WHERE session_id = ? AND status = 'open'",
    ).all(sessionId) as PositionRow[];
  },

  findAllBySession(sessionId: number): PositionRow[] {
    const db = getDb();
    return db.query(
      'SELECT * FROM positions WHERE session_id = ? ORDER BY opened_at DESC',
    ).all(sessionId) as PositionRow[];
  },

  findAllOpenByAsset(asset: AssetSymbol): PositionRow[] {
    const db = getDb();
    return db.query(
      "SELECT * FROM positions WHERE asset = ? AND status = 'open'",
    ).all(asset) as PositionRow[];
  },

  findAllOpen(): PositionRow[] {
    const db = getDb();
    return db.query("SELECT * FROM positions WHERE status = 'open'").all() as PositionRow[];
  },

  create(pos: Omit<PositionRow, 'close_price' | 'pnl' | 'closed_at'>): PositionRow {
    const db = getDb();
    return db.query(
      'INSERT INTO positions (id, session_id, player_id, asset, side, leverage, entry_price, quantity, margin, liquidation_price, stop_loss, take_profit, status, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
    ).get(
      pos.id, pos.session_id, pos.player_id, pos.asset, pos.side, pos.leverage,
      pos.entry_price, pos.quantity, pos.margin, pos.liquidation_price,
      pos.stop_loss ?? null, pos.take_profit ?? null, pos.status, pos.opened_at,
    ) as PositionRow;
  },

  updateStopLossTakeProfit(id: string, stopLoss: number | null, takeProfit: number | null): PositionRow {
    const db = getDb();
    return db.query(
      'UPDATE positions SET stop_loss = ?, take_profit = ? WHERE id = ? RETURNING *',
    ).get(stopLoss, takeProfit, id) as PositionRow;
  },

  close(id: string, closePrice: number, pnl: number, status: 'closed' | 'liquidated'): PositionRow {
    const db = getDb();
    return db.query(
      'UPDATE positions SET status = ?, close_price = ?, pnl = ?, closed_at = ? WHERE id = ? RETURNING *',
    ).get(status, closePrice, pnl, Date.now(), id) as PositionRow;
  },
};
