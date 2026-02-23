import { useEffect } from 'react';
import { useTradingStore } from '../store/tradingStore';
import { useGameStore } from '../store/gameStore';
import { useConnectionStore } from '../store/connectionStore';

const MODULE_CARDS = [
  {
    step: 1,
    page: 'patterns' as const,
    icon: (
      <svg className="w-8 h-8 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 17l4-4 4 4 4-8 6 6" />
        <circle cx="7" cy="13" r="1" fill="currentColor" />
        <circle cx="11" cy="17" r="1" fill="currentColor" />
        <circle cx="15" cy="9" r="1" fill="currentColor" />
      </svg>
    ),
    title: 'Pattern Recognition',
    description: 'Identify chart patterns from real historical data. Learn to spot double tops, head & shoulders, flags, and more.',
    cta: 'Start Challenge',
    gradient: 'from-indigo-900/40 to-violet-900/30',
    border: 'border-indigo-500/20',
    ctaGradient: 'from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500',
    tag: 'START HERE',
  },
  {
    step: 2,
    page: 'predictions' as const,
    icon: (
      <svg className="w-8 h-8 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Market Forecast',
    description: 'Forecast price direction on real historical charts. See the result instantly with simulated fast-forward.',
    cta: 'Start Forecasting',
    gradient: 'from-cyan-900/40 to-teal-900/30',
    border: 'border-cyan-500/20',
    ctaGradient: 'from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500',
  },
  {
    step: 3,
    page: 'trading' as const,
    icon: (
      <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v20M2 12h20M6 6l12 12M18 6L6 18" />
      </svg>
    ),
    title: 'Paper Trading',
    description: 'Trade futures & options with $10K virtual balance on live market data. Risk-adjusted scoring with Sharpe ratio.',
    cta: 'Start Session',
    gradient: 'from-emerald-900/40 to-green-900/30',
    border: 'border-emerald-500/20',
    ctaGradient: 'from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500',
    isTrading: true,
  },
] as const;

export function LobbyPage() {
  const startSession = useTradingStore((s) => s.startSession);
  const loadSession = useTradingStore((s) => s.loadSession);
  const sessionId = useTradingStore((s) => s.sessionId);
  const navigateTo = useGameStore((s) => s.navigateTo);
  const level = useGameStore((s) => s.level);
  const levelInfo = useGameStore((s) => s.levelInfo);
  const xp = useGameStore((s) => s.xp);
  const player = useConnectionStore((s) => s.player);

  useEffect(() => {
    loadSession().catch(() => { });
  }, [loadSession]);

  const handleModuleClick = async (page: string, isTrading?: boolean) => {
    if (isTrading) {
      try {
        await startSession();
      } catch {
        await loadSession();
      }
    } else {
      navigateTo(page as 'patterns' | 'predictions');
    }
  };

  const truncateAddress = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  return (
    <div className="h-full p-3 sm:p-4 overflow-auto">
      <div className="max-w-6xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Hero Section */}
        <div className="py-6 text-center border rounded-xl bg-gradient-to-br from-indigo-900/20 via-slate-900/10 to-cyan-900/20 border-slate-800/30 animate-gradient-shift">
          <h2 className="mb-2 text-2xl sm:text-3xl font-bold text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text">
            Welcome to Tradex
          </h2>
          <p className="mb-3 text-sm text-slate-200">
            Learn to trade. Prove it on-chain.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-indigo-300">
              <span className="w-5 h-5 rounded-full bg-indigo-600/80 flex items-center justify-center text-[10px] font-bold text-white">{level}</span>
              {levelInfo.title}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-200">{xp} XP</span>
            {sessionId && (
              <>
                <span className="text-slate-600">|</span>
                <span className="font-mono text-slate-400">Session #{sessionId}</span>
              </>
            )}
            {player?.wallet_address && (
              <>
                <span className="text-slate-600">|</span>
                <span className="font-mono text-slate-400">{truncateAddress(player.wallet_address)}</span>
              </>
            )}
          </div>
        </div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {MODULE_CARDS.map((card) => (
            <div
              key={card.page}
              className={`bg-gradient-to-br ${card.gradient} rounded-xl border ${card.border} p-5 flex flex-col relative overflow-hidden`}
            >
              {/* Step number */}
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold">
                {card.step}
              </div>

              {'tag' in card && card.tag && (
                <div className="mb-2">
                  <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {card.tag}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-3">
                {card.icon}
                <h3 className="text-sm font-bold text-white">{card.title}</h3>
              </div>
              <p className="flex-1 mb-4 text-xs text-slate-200">{card.description}</p>
              <button
                onClick={() => handleModuleClick(card.page, 'isTrading' in card && card.isTrading)}
                className={`w-full py-2.5 px-4 bg-gradient-to-r ${card.ctaGradient} text-white text-sm font-semibold rounded transition-all active:scale-[0.98] hover:shadow-lg hover:shadow-indigo-500/10`}
              >
                {card.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Quick navigation to other pages */}
        {/* <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <button
            onClick={() => navigateTo('profile')}
            className="p-4 text-left transition-colors border bg-slate-900/60 border-slate-800/50 rounded-xl hover:border-slate-700/50"
          >
            <div className="mb-1 text-lg">👤</div>
            <div className="text-xs font-semibold text-white">Profile</div>
            <div className="text-[10px] text-slate-400">Stats, badges, achievements</div>
          </button>
          <button
            onClick={() => navigateTo('leaderboard')}
            className="p-4 text-left transition-colors border bg-slate-900/60 border-slate-800/50 rounded-xl hover:border-slate-700/50"
          >
            <div className="mb-1 text-lg">🏆</div>
            <div className="text-xs font-semibold text-white">Leaderboard</div>
            <div className="text-[10px] text-slate-400">Global rankings</div>
          </button>
          <button
            onClick={() => navigateTo('patterns')}
            className="p-4 text-left transition-colors border bg-slate-900/60 border-slate-800/50 rounded-xl hover:border-slate-700/50"
          >
            <div className="mb-1 text-lg">📊</div>
            <div className="text-xs font-semibold text-white">Patterns</div>
            <div className="text-[10px] text-slate-400">{player?.pattern_correct || 0}/{player?.pattern_total || 0} correct</div>
          </button>
          <button
            onClick={() => navigateTo('predictions')}
            className="p-4 text-left transition-colors border bg-slate-900/60 border-slate-800/50 rounded-xl hover:border-slate-700/50"
          >
            <div className="mb-1 text-lg">🔮</div>
            <div className="text-xs font-semibold text-white">Forecast</div>
            <div className="text-[10px] text-slate-400">{player?.credibility_score || 0}% credibility</div>
          </button>
        </div> */}

        {/* Academy Section */}
        <div>
          <h3 className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-300">
            <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
              <path d="M12 14l6.16-3.42A12.08 12.08 0 0119 14.6C19 18.2 15.87 21 12 21s-7-2.8-7-6.4a12.08 12.08 0 01.84-4.02L12 14z" />
            </svg>
            Tradex Academy
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { title: 'Chart Reading 101', desc: 'Master candlestick patterns, support/resistance, and trend lines.', icon: '📊' },
              { title: 'Risk Management', desc: 'Learn position sizing, stop-loss strategies, and portfolio allocation.', icon: '🛡️' },
              { title: 'Technical Analysis', desc: 'Indicators, moving averages, RSI, MACD, and Bollinger Bands.', icon: '📐' },
            ].map((course) => (
              <div
                key={course.title}
                className="relative p-5 border pointer-events-none bg-gradient-to-br from-slate-800/60 to-slate-900/40 rounded-xl border-slate-700/30 opacity-60"
              >
                <div className="absolute top-3 right-3 px-2 py-0.5 text-[9px] font-bold tracking-wider rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  COMING SOON
                </div>
                <div className="mb-2 text-2xl">{course.icon}</div>
                <h4 className="mb-1 text-sm font-bold text-white">{course.title}</h4>
                <p className="text-xs text-slate-200">{course.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Powered by footer */}
        <div className="pb-2 text-center">
          <span className="text-[10px] text-slate-600">
            ZK-verified on Stellar Soroban with UltraHonk proofs
          </span>
        </div>
      </div>
    </div>
  );
}
