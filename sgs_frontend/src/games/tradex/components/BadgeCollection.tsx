import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { BADGE_DEFS } from '../types';

// Visual tiers based on badge type number
function getBadgeTier(type: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (type <= 2) return 'bronze';
  if (type <= 5) return 'silver';
  if (type <= 8) return 'gold';
  return 'platinum';
}

const TIER_RING: Record<string, string> = {
  bronze: 'ring-indigo-700/50',
  silver: 'ring-slate-400/50',
  gold: 'ring-cyan-500/50',
  platinum: 'ring-cyan-400/50',
};

const TIER_BG: Record<string, string> = {
  bronze: 'bg-indigo-900/20',
  silver: 'bg-slate-700/20',
  gold: 'bg-cyan-900/20',
  platinum: 'bg-cyan-900/20',
};

export function BadgeCollection() {
  const badges = useGameStore((s) => s.badges);
  const badgesLoading = useGameStore((s) => s.badgesLoading);
  const loadBadges = useGameStore((s) => s.loadBadges);
  const mintBadge = useGameStore((s) => s.mintBadge);
  const mintingBadge = useGameStore((s) => s.mintingBadge);
  const preparingBadge = useGameStore((s) => s.preparingBadge);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  // Build a lookup from badge defs (id -> eligible/minted from server)
  const badgeStatusMap = new Map(badges.map((b) => [b.id, b]));

  const handleMint = async (badgeId: string) => {
    await mintBadge(badgeId);
  };

  return (
    <div>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {BADGE_DEFS.map((def) => {
          const status = badgeStatusMap.get(def.id);
          const eligible = status?.eligible ?? false;
          const minted = status?.minted ?? false;
          const isMinting = mintingBadge === def.id || preparingBadge === def.id;
          const canMint = eligible && !minted;
          const tier = getBadgeTier(def.type);
          const isLevel = def.type <= 9;
          const label = isLevel ? `L${def.type + 1}` : `#${def.type - 9}`;

          return (
            <div
              key={def.id}
              className={`relative rounded-lg p-2.5 border text-center transition-all ${eligible
                  ? `ring-1 ${TIER_RING[tier]} ${TIER_BG[tier]} border-slate-700/50 bg-slate-800/80`
                  : 'opacity-30 bg-slate-800/30 border-slate-700/20'
                }`}
            >
              {minted && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">&#10003;</span>
                </div>
              )}
              <div className={`w-10 h-10 rounded-lg mx-auto mb-1.5 flex items-center justify-center text-sm font-bold ${eligible
                  ? 'bg-slate-700/60 text-white'
                  : 'bg-slate-800/60 text-slate-600'
                }`}>
                {label}
              </div>
              <div className={`text-[10px] font-semibold truncate ${eligible ? 'text-white' : 'text-slate-600'}`}>
                {def.name}
              </div>
              <div className="text-[8px]  leading-tight mt-0.5">
                {def.stat.replace(/_/g, ' ')}
              </div>

              {canMint && (
                <button
                  onClick={() => handleMint(def.id)}
                  disabled={isMinting}
                  className="mt-1.5 w-full py-1 text-[9px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-50"
                >
                  {isMinting ? 'Minting...' : 'Mint'}
                </button>
              )}
              {minted && (
                <div className="mt-1.5 text-[8px] text-green-400 font-medium">On-chain</div>
              )}
            </div>
          );
        })}
      </div>

      {badgesLoading && (
        <div className="text-center text-xs  mt-3">Loading badges...</div>
      )}
    </div>
  );
}
