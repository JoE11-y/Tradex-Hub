import { useGameStore } from '../store/gameStore';
import { ACHIEVEMENTS } from '../types';

interface AchievementGridProps {
  compact?: boolean;
}

export function AchievementGrid({ compact }: AchievementGridProps) {
  const unlockedAchievements = useGameStore((s) => s.unlockedAchievements);

  const display = compact ? ACHIEVEMENTS.slice(0, 6) : ACHIEVEMENTS;

  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {display.map((ach) => {
        const earned = unlockedAchievements.includes(ach.id);

        return (
          <div
            key={ach.id}
            className={`rounded-lg p-3 border transition-all ${earned
                ? 'bg-slate-800/80 border-indigo-500/30 ring-1 ring-indigo-500/20'
                : 'bg-slate-800/30 border-slate-700/30 opacity-50'
              }`}
          >
            <div className="flex items-start gap-2">
              <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${earned
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'bg-slate-700/50 '
                }`}>
                {earned ? '\u2713' : '?'}
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-semibold truncate ${earned ? 'text-white' : ''}`}>
                  {ach.name}
                </div>
                <div className="text-[10px]  leading-tight mt-0.5">
                  {earned ? ach.description : ach.condition}
                </div>
                {earned && (
                  <div className="text-[10px] text-indigo-400 mt-1">+{ach.xpReward} XP</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
