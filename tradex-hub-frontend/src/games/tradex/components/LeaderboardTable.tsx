import type { LeaderboardEntryData } from '../services/api';
import { useConnectionStore } from '../store/connectionStore';

interface LeaderboardTableProps {
  entries: LeaderboardEntryData[];
  compact?: boolean;
}

const RANK_STYLES: Record<number, string> = {
  1: 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30',
  2: 'bg-slate-400/20 text-slate-300 ring-1 ring-slate-400/30',
  3: 'bg-cyan-700/20 text-cyan-400 ring-1 ring-cyan-600/30',
};

export function LeaderboardTable({ entries, compact }: LeaderboardTableProps) {
  const player = useConnectionStore((s) => s.player);
  const currentPlayerId = player?.id;

  const displayEntries = compact ? entries.slice(0, 5) : entries;

  if (displayEntries.length === 0) {
    return (
      <div className="p-4 text-center text-sm ">
        No leaderboard data yet
      </div>
    );
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="md:hidden space-y-1.5 p-2">
        {displayEntries.map((entry) => {
          const isCurrentPlayer = entry.player_id === currentPlayerId;
          const rankStyle = RANK_STYLES[entry.rank];
          const isProfit = entry.total_pnl >= 0;

          return (
            <div
              key={entry.player_id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isCurrentPlayer ? 'bg-indigo-900/20 border border-indigo-500/20' : 'bg-slate-800/30'}`}
            >
              {rankStyle ? (
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${rankStyle}`}>
                  {entry.rank}
                </span>
              ) : (
                <span className="w-7 h-7 flex items-center justify-center text-xs text-slate-400 shrink-0">{entry.rank}</span>
              )}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isCurrentPlayer ? 'text-indigo-300' : 'text-white'}`}>
                  {entry.display_name || `${entry.wallet_address.slice(0, 6)}...`}
                </div>
                <div className="text-[10px] text-slate-400">{entry.xp} XP</div>
              </div>
              <div className={`text-sm font-medium shrink-0 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                {isProfit ? '+' : ''}${entry.total_pnl.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-200 border-b border-slate-700/50">
              <th className="text-center py-2 px-2 font-medium w-10">#</th>
              <th className="text-left py-2 px-2 font-medium">Trader</th>
              {!compact && <th className="text-center py-2 px-2 font-medium">Lv</th>}
              <th className="text-right py-2 px-2 font-medium">PnL</th>
              {!compact && <th className="text-right py-2 px-2 font-medium">Trades</th>}
              <th className="text-right py-2 px-2 font-medium">XP</th>
              {!compact && <th className="text-center py-2 px-2 font-medium">ZK</th>}
            </tr>
          </thead>
          <tbody>
            {displayEntries.map((entry) => {
              const isCurrentPlayer = entry.player_id === currentPlayerId;
              const rankStyle = RANK_STYLES[entry.rank];
              const isProfit = entry.total_pnl >= 0;

              return (
                <tr
                  key={entry.player_id}
                  className={`border-b border-slate-800/50 ${isCurrentPlayer ? 'bg-indigo-900/20' : 'hover:bg-slate-800/20'
                    }`}
                >
                  <td className="py-2 px-2 text-center">
                    {rankStyle ? (
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${rankStyle}`}>
                        {entry.rank}
                      </span>
                    ) : (
                      <span className="">{entry.rank}</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <span className={`font-medium ${isCurrentPlayer ? 'text-indigo-300' : 'text-white'}`}>
                      {entry.display_name || `${entry.wallet_address.slice(0, 6)}...`}
                    </span>
                  </td>
                  {!compact && (
                    <td className="py-2 px-2 text-center text-slate-200">{entry.level}</td>
                  )}
                  <td className={`py-2 px-2 text-right font-medium ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {isProfit ? '+' : ''}${entry.total_pnl.toFixed(2)}
                  </td>
                  {!compact && (
                    <td className="py-2 px-2 text-right text-slate-300">{entry.total_trades}</td>
                  )}
                  <td className="py-2 px-2 text-right text-indigo-400">{entry.xp}</td>
                  {!compact && (
                    <td className="py-2 px-2 text-center">
                      {entry.zk_verified && (
                        <span className="text-green-400 text-[10px] font-bold">ZK</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
