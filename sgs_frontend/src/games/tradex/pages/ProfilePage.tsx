import { PlayerCard } from '../components/PlayerCard';
import { BadgeCollection } from '../components/BadgeCollection';
import { AchievementGrid } from '../components/AchievementGrid';
import { useConnectionStore } from '../store/connectionStore';
import { useGameStore } from '../store/gameStore';

export function ProfilePage() {
  const player = useConnectionStore((s) => s.player);
  const { xp } = useGameStore();

  return (
    <div className="h-full overflow-auto p-4">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Player card */}
        <PlayerCard />

        {/* Stats panel */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800/50 p-5">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Lifetime Stats</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">{player?.total_sessions || 0}</div>
              <div className="text-[10px] ">Sessions</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${(player?.total_pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(player?.total_pnl || 0) >= 0 ? '+' : ''}${(player?.total_pnl || 0).toFixed(2)}
              </div>
              <div className="text-[10px] ">Lifetime PnL</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">
                {(player?.best_pnl_pct || 0).toFixed(1)}%
              </div>
              <div className="text-[10px] ">Best Session</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-indigo-400">{xp}</div>
              <div className="text-[10px] ">Total XP</div>
            </div>
          </div>
        </div>

        {/* Badge collection */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800/50 p-5">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Badge Collection</h3>
          <BadgeCollection />
        </div>

        {/* Achievements */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800/50 p-5">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Achievements</h3>
          <AchievementGrid />
        </div>
      </div>
    </div>
  );
}
