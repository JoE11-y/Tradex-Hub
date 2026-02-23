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

        {/* Coming Soon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              title: 'Pattern Champions',
              desc: 'Top pattern recognition accuracy and streaks across all players.',
              icon: (
                <svg className="w-6 h-6 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 17l4-4 4 4 4-8 6 6" />
                  <circle cx="7" cy="13" r="1" fill="currentColor" />
                  <circle cx="15" cy="9" r="1" fill="currentColor" />
                </svg>
              ),
              gradient: 'from-violet-900/30 to-indigo-900/20',
              border: 'border-violet-500/20',
            },
            {
              title: 'Forecast Leaders',
              desc: 'Highest credibility scores and prediction win rates.',
              icon: (
                <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              ),
              gradient: 'from-cyan-900/30 to-teal-900/20',
              border: 'border-cyan-500/20',
            },
            {
              title: 'Badge Holders',
              desc: 'ZK-verified badge collections minted on Stellar Soroban.',
              icon: (
                <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                </svg>
              ),
              gradient: 'from-amber-900/30 to-orange-900/20',
              border: 'border-amber-500/20',
            },
          ].map((card) => (
            <div
              key={card.title}
              className={`relative bg-gradient-to-br ${card.gradient} rounded-xl border ${card.border} p-4 opacity-60`}
            >
              <span className="absolute top-3 right-3 text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                COMING SOON
              </span>
              <div className="mb-2">{card.icon}</div>
              <h4 className="text-sm font-bold text-white mb-1">{card.title}</h4>
              <p className="text-xs text-slate-400">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
