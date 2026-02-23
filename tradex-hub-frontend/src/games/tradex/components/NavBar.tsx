import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { useConnectionStore } from '../store/connectionStore';
import type { PageName } from '../store/gameStore';
import { LEVELS } from '../types';

interface NavBarProps {
  onBack: () => void;
}

const NAV_TABS: { page: PageName; label: string }[] = [
  { page: 'lobby', label: 'Home' },
  { page: 'patterns', label: 'Patterns' },
  { page: 'predictions', label: 'Forecast' },
  { page: 'profile', label: 'Profile' },
  { page: 'leaderboard', label: 'Leaderboard' },
];

export function NavBar({ onBack }: NavBarProps) {
  const currentPage = useGameStore((s) => s.currentPage);
  const navigateTo = useGameStore((s) => s.navigateTo);
  const level = useGameStore((s) => s.level);
  const levelInfo = useGameStore((s) => s.levelInfo);
  const xp = useGameStore((s) => s.xp);
  const player = useConnectionStore((s) => s.player);

  const prevXp = useRef(xp);
  const [xpGlow, setXpGlow] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (xp > prevXp.current) {
      setXpGlow(true);
      const t = setTimeout(() => setXpGlow(false), 1000);
      return () => clearTimeout(t);
    }
    prevXp.current = xp;
  }, [xp]);

  const nextLevel = LEVELS.find((l) => l.level === level + 1);
  const xpProgress = nextLevel
    ? ((xp - levelInfo.xpRequired) / (nextLevel.xpRequired - levelInfo.xpRequired)) * 100
    : 100;

  const isActivePage = (page: PageName) => {
    if (page === 'lobby') return currentPage === 'lobby' || currentPage === 'trading' || currentPage === 'summary';
    return currentPage === page;
  };

  return (
    <header className="relative bg-slate-900 border-b border-slate-700/50 shrink-0">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <img src="/tradex-logo.png" alt="Tradex Hub" className="w-7 h-7" />
          <h1 className="text-sm sm:text-base font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent select-none">
            Tradex Hub
          </h1>
          <span className="text-[10px] text-slate-200 bg-slate-800 border border-slate-700/50 px-2 py-0.5 rounded hidden sm:inline">
            SIMULATED
          </span>

          <nav className="hidden md:flex items-center gap-1 ml-2">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.page}
                onClick={() => navigateTo(tab.page)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${isActivePage(tab.page)
                  ? 'text-white bg-slate-800'
                  : 'text-slate-200 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Player ID badge */}
          {player?.id && (
            <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700/50 hidden sm:inline">
              #{player.id}
            </span>
          )}

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full bg-indigo-600/80 flex items-center justify-center text-[10px] font-bold text-white transition-all ${level > 1 ? 'ring-2 ring-indigo-400/30' : ''}`}>
                {level}
              </div>
              <span className="text-xs text-slate-200 hidden sm:inline">
                {levelInfo.title}
              </span>
            </div>
            <div className={`w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block ${xpGlow ? 'animate-xp-bar-glow' : ''}`}>
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, xpProgress)}%` }}
              />
            </div>
            <span className={`text-[10px] hidden sm:inline transition-colors ${xpGlow ? 'text-indigo-300 animate-count-pulse' : ''}`}>{xp} XP</span>
          </div>

          <button
            onClick={onBack}
            className="py-1.5 px-3 text-xs hover:text-slate-300 hover:bg-slate-800/50 rounded transition-colors hidden md:inline-flex"
          >
            Back to Games
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen
                ? <path d="M6 18L18 6M6 6l12 12" />
                : <path d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <nav className="md:hidden absolute top-full left-0 right-0 bg-slate-900 border-b border-slate-700/50 z-50 py-2 px-3 space-y-1">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.page}
              onClick={() => { navigateTo(tab.page); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2.5 text-sm font-medium rounded transition-colors ${isActivePage(tab.page)
                ? 'text-white bg-slate-800'
                : 'text-slate-200 hover:text-white hover:bg-slate-800/50'
                }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => { onBack(); setMobileMenuOpen(false); }}
            className="w-full text-left px-3 py-2.5 text-sm text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 rounded transition-colors"
          >
            Back to Games
          </button>
        </nav>
      )}
    </header>
  );
}
