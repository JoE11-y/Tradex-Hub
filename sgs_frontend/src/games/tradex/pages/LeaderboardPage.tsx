import { useEffect } from 'react';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { useTradingStore } from '../store/tradingStore';

export function LeaderboardPage() {
  const leaderboardEntries = useTradingStore((s) => s.leaderboardEntries);
  const leaderboardPeriod = useTradingStore((s) => s.leaderboardPeriod);
  const leaderboardLoading = useTradingStore((s) => s.leaderboardLoading);
  const loadLeaderboard = useTradingStore((s) => s.loadLeaderboard);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  return (
    <div className="h-full overflow-auto p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header with period toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Leaderboard</h2>
          <div className="flex gap-1 bg-slate-900/80 rounded-lg p-1 border border-slate-800/50">
            <button
              onClick={() => loadLeaderboard('weekly')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${leaderboardPeriod === 'weekly'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-200 hover:text-slate-200'
                }`}
            >
              Weekly
            </button>
            <button
              onClick={() => loadLeaderboard('all_time')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${leaderboardPeriod === 'all_time'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-200 hover:text-slate-200'
                }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800/50">
          {leaderboardLoading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs ">Loading leaderboard...</p>
            </div>
          ) : (
            <LeaderboardTable entries={leaderboardEntries} />
          )}
        </div>
      </div>
    </div>
  );
}
