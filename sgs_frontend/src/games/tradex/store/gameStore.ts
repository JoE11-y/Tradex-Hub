import { create } from 'zustand';
import type { PlayerLevel } from '../types';
import { LEVELS, ACHIEVEMENTS } from '../types';
import type { PlayerProfile, SessionData, TradeData, BadgeEligibleData } from '../services/api';
import { badgeApi } from '../services/api';

export type PageName = 'lobby' | 'trading' | 'summary' | 'profile' | 'leaderboard' | 'patterns' | 'predictions';

export interface SessionSummaryData {
  session: SessionData;
  trades: TradeData[];
  totalPnl: number;
  xpEarned: number;
  finalBalance: number;
  achievementsEarned: string[];
}

interface Notification {
  id: string;
  type: 'xp' | 'level_up' | 'achievement' | 'liquidation' | 'info';
  title: string;
  message: string;
  timestamp: number;
}

interface GameState {
  // Navigation
  currentPage: PageName;

  // Player progression (from server)
  xp: number;
  level: number;
  levelInfo: PlayerLevel;
  unlockedAchievements: string[];

  // Session summary (for summary page)
  sessionSummary: SessionSummaryData | null;

  // Badges (eligible list with status)
  badges: BadgeEligibleData[];
  badgesLoading: boolean;
  preparingBadge: string | null;
  mintingBadge: string | null;

  // Notifications (local UI only)
  notifications: Notification[];

  // Actions - navigation
  navigateTo: (page: PageName) => void;
  setSessionSummary: (summary: SessionSummaryData) => void;

  // Actions - server sync
  syncFromProfile: (profile: PlayerProfile) => void;
  handleXpAwarded: (amount: number, reason: string, totalXp: number) => void;
  handleLevelUp: (newLevel: number, title: string) => void;
  handleAchievementUnlocked: (achievement: { id: string; name: string; description: string }) => void;

  // Actions - badges
  loadBadges: () => Promise<void>;
  prepareBadge: (badgeId: string) => Promise<string | null>;
  mintBadge: (badgeId: string) => Promise<string | null>;

  // Actions - notifications
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  dismissNotification: (id: string) => void;

  // Reset
  reset: () => void;
}

function getInitialPage(): PageName {
  try {
    const saved = sessionStorage.getItem('tradex_page');
    if (saved && ['lobby', 'trading', 'summary', 'profile', 'leaderboard', 'patterns', 'predictions'].includes(saved)) {
      return saved as PageName;
    }
  } catch {}
  return 'lobby';
}

export const useGameStore = create<GameState>()((set, get) => ({
  currentPage: getInitialPage(),
  xp: 0,
  level: 1,
  levelInfo: LEVELS[0],
  unlockedAchievements: [],
  sessionSummary: null,
  badges: [],
  badgesLoading: false,
  preparingBadge: null,
  mintingBadge: null,
  notifications: [],

  navigateTo: (page) => {
    set({ currentPage: page });
    try { sessionStorage.setItem('tradex_page', page); } catch {}
  },

  setSessionSummary: (summary) => set({ sessionSummary: summary }),

  syncFromProfile: (profile) => {
    const levelInfo = LEVELS.find((l) => l.level === profile.level) || LEVELS[0];
    set({
      xp: profile.xp,
      level: profile.level,
      levelInfo,
      unlockedAchievements: profile.achievements,
    });
  },

  handleXpAwarded: (amount, reason, totalXp) => {
    set({ xp: totalXp });
    get().addNotification({
      type: 'xp',
      title: `+${amount} XP`,
      message: reason,
    });
  },

  handleLevelUp: (newLevel, title) => {
    const levelInfo = LEVELS.find((l) => l.level === newLevel) || LEVELS[0];
    set({ level: newLevel, levelInfo });
    get().addNotification({
      type: 'level_up',
      title: 'Level Up!',
      message: `You are now a ${title} (Level ${newLevel})`,
    });
  },

  handleAchievementUnlocked: (achievement) => {
    set((s) => ({
      unlockedAchievements: [...s.unlockedAchievements, achievement.id],
    }));
    get().addNotification({
      type: 'achievement',
      title: 'Achievement Unlocked!',
      message: `${achievement.name} - ${achievement.description}`,
    });
  },

  loadBadges: async () => {
    set({ badgesLoading: true });
    try {
      const { badges } = await badgeApi.getEligible();
      set({ badges, badgesLoading: false });
    } catch {
      set({ badgesLoading: false });
    }
  },

  prepareBadge: async (badgeId) => {
    set({ preparingBadge: badgeId });
    try {
      const result = await badgeApi.prepare(badgeId);
      set({ preparingBadge: null });
      return result.proof_hex;
    } catch {
      set({ preparingBadge: null });
      return null;
    }
  },

  mintBadge: async (badgeId) => {
    set({ mintingBadge: badgeId });
    try {
      // Ensure proof exists first
      await badgeApi.prepare(badgeId);
      // Then mint on-chain
      const result = await badgeApi.mint(badgeId);
      set({ mintingBadge: null });

      // Reload badges to reflect minted status
      get().loadBadges();

      if (!result.already_minted) {
        get().addNotification({
          type: 'achievement',
          title: 'Badge Minted!',
          message: `Badge minted on Stellar testnet`,
        });
      }
      return result.soroban_tx_hash;
    } catch {
      set({ mintingBadge: null });
      return null;
    }
  },

  addNotification: (notification) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id, timestamp: Date.now() },
      ].slice(-10),
    }));
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  reset: () => set({
    currentPage: 'lobby',
    xp: 0,
    level: 1,
    levelInfo: LEVELS[0],
    unlockedAchievements: [],
    sessionSummary: null,
    badges: [],
    badgesLoading: false,
    preparingBadge: null,
    mintingBadge: null,
    notifications: [],
  }),
}));
