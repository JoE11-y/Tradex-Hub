import { useEffect } from 'react';
import { PlayerCard } from '../components/PlayerCard';
import { BadgeCollection } from '../components/BadgeCollection';
import { AchievementGrid } from '../components/AchievementGrid';
import { useConnectionStore } from '../store/connectionStore';
import { useGameStore } from '../store/gameStore';
import { playerApi } from '../services/api';

export function ProfilePage() {
  const player = useConnectionStore((s) => s.player);
  const refreshPlayer = useConnectionStore((s) => s.refreshPlayer);
  const { xp } = useGameStore();
  const syncFromProfile = useGameStore((s) => s.syncFromProfile);

  // Refresh player data and sync XP on mount
  useEffect(() => {
    refreshPlayer();
    playerApi.getProfile().then(syncFromProfile).catch(() => {});
  }, [refreshPlayer, syncFromProfile]);

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
              <div className="text-lg font-bold text-indigo-400">{xp}</div>
              <div className="text-[10px] text-slate-400">Total XP</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">{player?.total_sessions || 0}</div>
              <div className="text-[10px] text-slate-400">Sessions</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${(player?.total_pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(player?.total_pnl || 0) >= 0 ? '+' : ''}${(player?.total_pnl || 0).toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400">Lifetime PnL</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">
                {(player?.best_pnl_pct || 0).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400">Best Session</div>
            </div>
          </div>

          {/* Education stats */}
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mt-5 mb-3">Education</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-violet-400">
                {player?.pattern_correct || 0}/{player?.pattern_total || 0}
              </div>
              <div className="text-[10px] text-slate-400">Patterns</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-violet-400">{player?.pattern_best_streak || 0}</div>
              <div className="text-[10px] text-slate-400">Best Streak</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-cyan-400">
                {player?.prediction_correct || 0}/{player?.prediction_total || 0}
              </div>
              <div className="text-[10px] text-slate-400">Predictions</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-cyan-400">{player?.credibility_score || 0}%</div>
              <div className="text-[10px] text-slate-400">Credibility</div>
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
