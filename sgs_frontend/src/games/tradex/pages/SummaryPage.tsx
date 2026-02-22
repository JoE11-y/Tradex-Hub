import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { useTradingStore } from '../store/tradingStore';
import { ACHIEVEMENTS, STARTING_BALANCE } from '../types';

/** Animate a number from 0 to target over duration ms */
function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

export function SummaryPage() {
  const sessionSummary = useGameStore((s) => s.sessionSummary);
  const navigateTo = useGameStore((s) => s.navigateTo);
  const startSession = useTradingStore((s) => s.startSession);

  if (!sessionSummary) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-200 mb-4">No session data available</p>
          <button
            onClick={() => navigateTo('lobby')}
            className="px-6 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const { session, trades, totalPnl, xpEarned, finalBalance, achievementsEarned } = sessionSummary;
  const isProfit = totalPnl >= 0;
  const returnPct = ((finalBalance - STARTING_BALANCE) / STARTING_BALANCE * 100);
  const winCount = trades.filter((t) => t.result === 'profit').length;
  const winRate = trades.length > 0 ? (winCount / trades.length * 100) : 0;

  const animatedPnl = useCountUp(totalPnl, 1500);
  const animatedReturn = useCountUp(returnPct, 1500);

  return (
    <div className="h-full overflow-auto p-4 relative">
      {/* Confetti for profitable sessions */}
      {isProfit && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-8px',
                backgroundColor: ['#22c55e', '#6366f1', '#06b6d4', '#f59e0b', '#ec4899'][i % 5],
                animation: `confetti-fall ${2 + Math.random() * 2}s ease-in ${Math.random() * 0.5}s forwards`,
              }}
            />
          ))}
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-5 relative z-20">
        {/* Big PnL header */}
        <div className={`rounded-xl p-6 text-center border animate-fade-in-up ${isProfit
          ? 'bg-gradient-to-br from-green-900/30 to-emerald-900/20 border-green-500/20'
          : 'bg-gradient-to-br from-red-900/30 to-rose-900/20 border-red-500/20'
          }`}>
          <div className="text-sm text-slate-200 mb-1">Session Result</div>
          <div className={`text-4xl font-bold mb-1 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}${animatedPnl.toFixed(2)}
          </div>
          <div className={`text-sm font-medium ${isProfit ? 'text-green-500/70' : 'text-red-500/70'}`}>
            {isProfit ? '+' : ''}{animatedReturn.toFixed(2)}% return
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800/50 text-center">
            <div className="text-lg font-bold text-white">${STARTING_BALANCE.toLocaleString()}</div>
            <div className="text-[10px] ">Starting Balance</div>
          </div>
          <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800/50 text-center">
            <div className={`text-lg font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              ${finalBalance.toFixed(2)}
            </div>
            <div className="text-[10px] ">Final Balance</div>
          </div>
          <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800/50 text-center">
            <div className="text-lg font-bold text-white">{trades.length}</div>
            <div className="text-[10px] ">Total Trades</div>
          </div>
          <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800/50 text-center">
            <div className="text-lg font-bold text-white">{winRate.toFixed(0)}%</div>
            <div className="text-[10px] ">Win Rate</div>
          </div>
        </div>

        {/* XP Earned */}
        <div className="bg-slate-900/80 rounded-lg p-4 border border-slate-800/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">XP Earned This Session</span>
            <span className="text-lg font-bold text-indigo-400">+{xpEarned} XP</span>
          </div>
          <div className="text-xs  mt-1">
            From {trades.length} trades + session bonus
          </div>
        </div>

        {/* Achievements earned this session */}
        {achievementsEarned.length > 0 && (
          <div className="bg-slate-900/80 rounded-lg p-4 border border-indigo-500/20">
            <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
              Achievements Unlocked
            </div>
            <div className="space-y-2">
              {achievementsEarned.map((achId) => {
                const ach = ACHIEVEMENTS.find((a) => a.id === achId);
                if (!ach) return null;
                return (
                  <div
                    key={achId}
                    className="flex items-center gap-3 bg-indigo-900/20 rounded-lg p-3 border border-indigo-500/20"
                  >
                    <div className="w-8 h-8 rounded-md bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-bold">
                      {'\u2713'}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{ach.name}</div>
                      <div className="text-[10px] text-slate-200">{ach.description}</div>
                    </div>
                    <div className="text-xs font-semibold text-indigo-400">+{ach.xpReward} XP</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => navigateTo('lobby')}
            className="flex-1 py-3 text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Back to Lobby
          </button>
          <button
            onClick={() => startSession().catch(console.error)}
            className="flex-1 py-3 text-sm font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-lg transition-all"
          >
            Trade Again
          </button>
        </div>
      </div>
    </div>
  );
}
