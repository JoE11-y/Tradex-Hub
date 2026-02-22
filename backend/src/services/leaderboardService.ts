import { getDb, withTransaction } from '../db/connection';
import { CONFIG } from '../config';
import { broadcastToAll } from '../ws/broadcaster';
import type { LeaderboardEntry } from '../domain/types';

let cachedLeaderboard: LeaderboardEntry[] = [];
let rebuildTimer: ReturnType<typeof setInterval> | null = null;

export const leaderboardService = {
  rebuild(): LeaderboardEntry[] {
    const db = getDb();

    // Require min 10 trades and 2+ sessions to prevent gaming; rank by risk-adjusted score
    const rows = db.query(`
      SELECT
        p.id as player_id,
        p.wallet_address,
        p.display_name,
        p.level,
        p.total_pnl,
        p.best_pnl_pct,
        p.total_trades,
        p.xp,
        EXISTS(
          SELECT 1 FROM player_badges pb
          WHERE pb.player_id = p.id AND pb.soroban_tx_hash IS NOT NULL
        ) as zk_verified,
        COALESCE((
          SELECT AVG(ts.sharpe_ratio) FROM trading_sessions ts
          WHERE ts.player_id = p.id AND ts.status = 'ended' AND ts.sharpe_ratio != 0
        ), 0) as sharpe_ratio
      FROM players p
      WHERE p.total_trades >= 10
        AND (SELECT COUNT(*) FROM trading_sessions ts WHERE ts.player_id = p.id AND ts.status = 'ended') >= 2
      ORDER BY sharpe_ratio DESC, p.total_pnl DESC
      LIMIT 100
    `).all() as Array<{
      player_id: number;
      wallet_address: string;
      display_name: string;
      level: number;
      total_pnl: number;
      best_pnl_pct: number;
      total_trades: number;
      xp: number;
      zk_verified: number;
      sharpe_ratio: number;
    }>;

    cachedLeaderboard = rows.map((r, i) => ({
      rank: i + 1,
      player_id: r.player_id,
      wallet_address: r.wallet_address,
      display_name: r.display_name,
      level: r.level,
      total_pnl: r.total_pnl,
      best_pnl_pct: r.best_pnl_pct,
      total_trades: r.total_trades,
      xp: r.xp,
      zk_verified: !!r.zk_verified,
      sharpe_ratio: Math.round(r.sharpe_ratio * 100) / 100,
    }));

    // Update cache table in a transaction
    withTransaction(() => {
      db.query('DELETE FROM leaderboard_cache').run();
      const stmt = db.query(
        'INSERT INTO leaderboard_cache (rank, player_id, wallet_address, display_name, level, total_pnl, best_pnl_pct, total_trades, xp, zk_verified, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      );
      const now = Date.now();
      for (const entry of cachedLeaderboard) {
        stmt.run(entry.rank, entry.player_id, entry.wallet_address, entry.display_name, entry.level, entry.total_pnl, entry.best_pnl_pct, entry.total_trades, entry.xp, entry.zk_verified ? 1 : 0, now);
      }
    });

    return cachedLeaderboard;
  },

  getCached(): LeaderboardEntry[] {
    return cachedLeaderboard;
  },

  get(period: 'weekly' | 'all_time' = 'all_time'): LeaderboardEntry[] {
    if (period === 'weekly') {
      return this.getWeekly();
    }
    if (cachedLeaderboard.length === 0) {
      return this.rebuild();
    }
    return cachedLeaderboard;
  },

  getWeekly(): LeaderboardEntry[] {
    const db = getDb();
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const rows = db.query(`
      SELECT
        t.player_id,
        p.wallet_address,
        p.display_name,
        p.level,
        SUM(t.pnl) as total_pnl,
        MAX(t.pnl_percent) as best_pnl_pct,
        COUNT(*) as total_trades,
        p.xp,
        EXISTS(
          SELECT 1 FROM player_badges pb
          WHERE pb.player_id = p.id AND pb.soroban_tx_hash IS NOT NULL
        ) as zk_verified,
        COALESCE((
          SELECT AVG(ts.sharpe_ratio) FROM trading_sessions ts
          WHERE ts.player_id = t.player_id AND ts.status = 'ended'
            AND ts.ended_at >= ? AND ts.sharpe_ratio != 0
        ), 0) as sharpe_ratio
      FROM trades t
      JOIN players p ON p.id = t.player_id
      WHERE t.closed_at >= ?
      GROUP BY t.player_id
      HAVING COUNT(*) >= 5
      ORDER BY sharpe_ratio DESC, total_pnl DESC
      LIMIT 100
    `).all(oneWeekAgo, oneWeekAgo) as Array<{
      player_id: number;
      wallet_address: string;
      display_name: string;
      level: number;
      total_pnl: number;
      best_pnl_pct: number;
      total_trades: number;
      xp: number;
      zk_verified: number;
      sharpe_ratio: number;
    }>;
    return rows.map((r, i) => ({
      rank: i + 1,
      player_id: r.player_id,
      wallet_address: r.wallet_address,
      display_name: r.display_name,
      level: r.level,
      total_pnl: r.total_pnl,
      best_pnl_pct: r.best_pnl_pct,
      total_trades: r.total_trades,
      xp: r.xp,
      zk_verified: !!r.zk_verified,
      sharpe_ratio: Math.round(r.sharpe_ratio * 100) / 100,
    }));
  },
};

export function startLeaderboardRebuild(): void {
  if (rebuildTimer) return;
  console.log('[leaderboard] Starting leaderboard rebuild timer');

  // Initial build
  try { leaderboardService.rebuild(); } catch (e) { console.error(e); }

  rebuildTimer = setInterval(() => {
    try {
      const entries = leaderboardService.rebuild();
      if (entries.length > 0) {
        broadcastToAll({
          type: 'leaderboard_update',
          entries: entries.slice(0, 20),
        });
      }
    } catch (err) {
      console.error('[leaderboard] Rebuild error:', err);
    }
  }, CONFIG.LEADERBOARD_REBUILD_INTERVAL_MS);
}

export function stopLeaderboardRebuild(): void {
  if (rebuildTimer) {
    clearInterval(rebuildTimer);
    rebuildTimer = null;
  }
}
