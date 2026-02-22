import { useState, useEffect } from 'react';
import { sessionApi } from '../services/api';
import type { SessionData } from '../services/api';

export function SessionHistoryList() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sessionApi
      .getHistory(5)
      .then(({ sessions: s }) => setSessions(s))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-slate-800/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center text-sm ">
        No previous sessions
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-200 border-b border-slate-700/50">
            <th className="text-left py-2 px-3 font-medium">Date</th>
            <th className="text-right py-2 px-2 font-medium">Trades</th>
            <th className="text-right py-2 px-2 font-medium">PnL</th>
            <th className="text-right py-2 px-2 font-medium">XP</th>
            <th className="text-right py-2 px-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const date = new Date(s.started_at);
            const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const isProfit = s.total_pnl >= 0;

            return (
              <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                <td className="py-2 px-3 text-slate-300">{dateStr}</td>
                <td className="py-2 px-2 text-right text-slate-300">{s.trade_count}</td>
                <td className={`py-2 px-2 text-right font-medium ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                  {isProfit ? '+' : ''}${s.total_pnl.toFixed(2)}
                </td>
                <td className="py-2 px-2 text-right text-indigo-400">+{s.xp_earned}</td>
                <td className="py-2 px-3 text-right">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.status === 'completed'
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-cyan-900/50 text-cyan-400'
                    }`}>
                    {s.status === 'completed' ? 'DONE' : s.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
