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
    <div className="overflow-x-auto">
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
  );
}
