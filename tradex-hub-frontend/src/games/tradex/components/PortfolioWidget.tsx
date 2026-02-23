import { useTradingStore } from '../store/tradingStore';
import { useGameStore } from '../store/gameStore';
import { LEVELS } from '../types';

export function PortfolioWidget() {
  const portfolio = useTradingStore((s) => s.portfolio);
  const drawdownLockoutUntil = useTradingStore((s) => s.drawdownLockoutUntil);
  const drawdownPct = useTradingStore((s) => s.drawdownPct);
  const xp = useGameStore((s) => s.xp);
  const level = useGameStore((s) => s.level);
  const levelInfo = useGameStore((s) => s.levelInfo);
  const isLocked = drawdownLockoutUntil ? drawdownLockoutUntil > Date.now() : false;

  const equity = portfolio.balance + portfolio.lockedMargin + portfolio.unrealizedPnl;
  const totalReturn = ((equity - portfolio.startingBalance) / portfolio.startingBalance) * 100;
  const winRate =
    portfolio.totalTrades > 0
      ? (portfolio.winCount / portfolio.totalTrades) * 100
      : 0;

  // XP progress to next level
  const nextLevel = LEVELS.find((l) => l.level === level + 1);
  const xpProgress = nextLevel
    ? ((xp - levelInfo.xpRequired) / (nextLevel.xpRequired - levelInfo.xpRequired)) * 100
    : 100;

  return (
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
      {/* Level & XP */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-indigo-400">
            Lv.{level} {levelInfo.title}
          </span>
          <span className="text-[10px] text-slate-200">{xp} XP</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500 bg-indigo-500 rounded-full"
            style={{ width: `${Math.min(100, xpProgress)}%` }}
          />
        </div>
        {nextLevel && (
          <div className="text-[10px]  mt-0.5 text-right">
            {nextLevel.xpRequired - xp} XP to {nextLevel.title}
          </div>
        )}
      </div>

      {/* Equity */}
      <div className="p-3 mt-1 mb-1 rounded-lg bg-slate-800/50">
        <div className="text-xs text-slate-200 mb-0.5">Total Equity</div>
        <div className="text-xl font-bold text-white">
          ${equity.toFixed(2)}
        </div>
        <div
          className={`text-xs font-medium ${totalReturn >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
        >
          {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
        </div>
      </div>

      {/* Drawdown lockout warning */}
      {isLocked && drawdownPct !== null && (
        <div className="p-2 text-center border rounded-lg bg-red-900/30 border-red-500/30">
          <div className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Drawdown Lockout</div>
          <div className="text-xs text-red-300 mt-0.5">{drawdownPct.toFixed(1)}% drawdown — new positions locked</div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-slate-800/30">
          <div className="text-[10px] ">Available</div>
          <div className="text-sm font-medium text-white">
            ${portfolio.balance.toFixed(2)}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-800/30">
          <div className="text-[10px] ">In Positions</div>
          <div className="text-sm font-medium text-white">
            ${portfolio.lockedMargin.toFixed(2)}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-800/30">
          <div className="text-[10px] ">Unrealized PnL</div>
          <div
            className={`text-sm font-medium ${portfolio.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
          >
            {portfolio.unrealizedPnl >= 0 ? '+' : ''}$
            {portfolio.unrealizedPnl.toFixed(2)}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-800/30">
          <div className="text-[10px] ">Realized PnL</div>
          <div
            className={`text-sm font-medium ${portfolio.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
          >
            {portfolio.totalPnl >= 0 ? '+' : ''}${portfolio.totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Trade stats */}
      <div className="flex items-center justify-between pt-3 text-xs border-t text-slate-200 border-slate-700/50">
        <span>Trades: {portfolio.totalTrades}</span>
        <span>
          Win Rate: {winRate.toFixed(0)}% ({portfolio.winCount}W/{portfolio.lossCount}L)
        </span>
      </div>
    </div>
  );
}
