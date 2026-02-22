import { getDb } from '../connection';
import type { OptionContractRow, OptionTradeRow } from '../../domain/types';

export const optionRepo = {
  createContract(opt: Omit<OptionContractRow, 'settlement_price' | 'pnl' | 'settled_at'>): OptionContractRow {
    const db = getDb();
    return db.query(
      'INSERT INTO option_contracts (id, session_id, player_id, asset, option_type, strike_price, spot_at_open, premium, expiry, expires_at, status, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
    ).get(
      opt.id, opt.session_id, opt.player_id, opt.asset, opt.option_type, opt.strike_price,
      opt.spot_at_open, opt.premium, opt.expiry, opt.expires_at, opt.status, opt.opened_at,
    ) as OptionContractRow;
  },

  findActiveBySession(sessionId: number): OptionContractRow[] {
    const db = getDb();
    return db.query(
      "SELECT * FROM option_contracts WHERE session_id = ? AND status = 'active'",
    ).all(sessionId) as OptionContractRow[];
  },

  findExpired(): OptionContractRow[] {
    const db = getDb();
    return db.query(
      "SELECT * FROM option_contracts WHERE status = 'active' AND expires_at <= ?",
    ).all(Date.now()) as OptionContractRow[];
  },

  settle(id: string, settlementPrice: number, pnl: number): OptionContractRow {
    const db = getDb();
    return db.query(
      "UPDATE option_contracts SET status = 'settled', settlement_price = ?, pnl = ?, settled_at = ? WHERE id = ? RETURNING *",
    ).get(settlementPrice, pnl, Date.now(), id) as OptionContractRow;
  },

  createTrade(trade: OptionTradeRow): OptionTradeRow {
    const db = getDb();
    return db.query(
      'INSERT INTO option_trades (id, option_id, session_id, player_id, asset, option_type, strike_price, premium, expiry, spot_at_open, settlement_price, pnl, opened_at, settled_at, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
    ).get(
      trade.id, trade.option_id, trade.session_id, trade.player_id, trade.asset,
      trade.option_type, trade.strike_price, trade.premium, trade.expiry, trade.spot_at_open,
      trade.settlement_price, trade.pnl, trade.opened_at, trade.settled_at, trade.result,
    ) as OptionTradeRow;
  },

  findTradesBySession(sessionId: number): OptionTradeRow[] {
    const db = getDb();
    return db.query(
      'SELECT * FROM option_trades WHERE session_id = ? ORDER BY settled_at DESC',
    ).all(sessionId) as OptionTradeRow[];
  },

  countBySession(sessionId: number): number {
    const db = getDb();
    const row = db.query('SELECT COUNT(*) as count FROM option_contracts WHERE session_id = ?').get(sessionId) as { count: number };
    return row.count;
  },
};
