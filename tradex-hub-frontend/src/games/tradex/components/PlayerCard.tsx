import { useGameStore } from '../store/gameStore';
import { useConnectionStore } from '../store/connectionStore';
import { LEVELS } from '../types';

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-slate-600',
  2: 'bg-slate-500',
  3: 'bg-blue-600',
  4: 'bg-blue-500',
  5: 'bg-indigo-600',
  6: 'bg-indigo-500',
  7: 'bg-purple-600',
  8: 'bg-purple-500',
  9: 'bg-violet-600',
  10: 'bg-violet-500',
};

interface PlayerCardProps {
  compact?: boolean;
}

export function PlayerCard({ compact }: PlayerCardProps) {
  const level = useGameStore((s) => s.level);
  const levelInfo = useGameStore((s) => s.levelInfo);
  const xp = useGameStore((s) => s.xp);
  const player = useConnectionStore((s) => s.player);

  const nextLevel = LEVELS.find((l) => l.level === level + 1);
  const xpProgress = nextLevel
    ? ((xp - levelInfo.xpRequired) / (nextLevel.xpRequired - levelInfo.xpRequired)) * 100
    : 100;

  const walletAddr = player?.wallet_address || '';
  const truncated = walletAddr.length > 12
    ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}`
    : walletAddr;

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-slate-900/80 rounded-lg p-3 border border-slate-800/50">
        <div className={`w-10 h-10 rounded-full ${LEVEL_COLORS[level] || 'bg-indigo-600'} flex items-center justify-center text-sm font-bold text-white shrink-0`}>
          {level}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{player?.display_name || 'Trader'}</div>
          <div className="text-[10px] text-slate-200">{levelInfo.title}</div>
        </div>
        <div className="text-right text-xs text-slate-200">{xp} XP</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-800/50">
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-14 h-14 rounded-full ${LEVEL_COLORS[level] || 'bg-indigo-600'} flex items-center justify-center text-xl font-bold text-white shrink-0 ring-2 ring-indigo-400/30`}>
          {level}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold text-white">{player?.display_name || 'Trader'}</div>
          <div className="text-sm text-indigo-400">{levelInfo.title}</div>
          <div className="text-xs  font-mono mt-0.5">{truncated}</div>
        </div>
      </div>

      {/* XP progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-200">{xp} XP</span>
          {nextLevel && (
            <span className="text-[10px] ">
              {nextLevel.xpRequired - xp} to Lv.{nextLevel.level}
            </span>
          )}
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, xpProgress)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-lg font-bold text-white">{player?.total_trades || 0}</div>
          <div className="text-[10px] ">Trades</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold ${(player?.total_pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${(player?.total_pnl || 0).toFixed(0)}
          </div>
          <div className="text-[10px] ">Lifetime PnL</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-white">{player?.total_sessions || 0}</div>
          <div className="text-[10px] ">Sessions</div>
        </div>
      </div>
    </div>
  );
}
