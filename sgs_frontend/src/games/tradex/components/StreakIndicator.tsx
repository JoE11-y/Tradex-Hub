interface StreakIndicatorProps {
  streak: number;
  multiplier: number;
  className?: string;
}

export function StreakIndicator({ streak, multiplier, className = '' }: StreakIndicatorProps) {
  if (streak === 0) return null;

  const color = streak >= 10
    ? 'text-violet-400 bg-violet-500/10 border-violet-500/30'
    : streak >= 6
      ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
      : streak >= 3
        ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
        : 'text-slate-200 bg-slate-500/10 border-slate-500/30';

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${color} ${className}`}>
      <span>{streak} streak</span>
      {multiplier > 1 && (
        <span className="font-bold">{multiplier}x</span>
      )}
    </div>
  );
}
