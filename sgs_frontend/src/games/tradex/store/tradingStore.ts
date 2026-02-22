import { create } from "zustand";
import type {
  AssetSymbol,
  Candle,
  TimeInterval,
  OptionType,
  OptionExpiry,
} from "../types";
import { STARTING_BALANCE } from "../types";
import {
  tradeApi,
  sessionApi,
  pricesApi,
  optionsApi,
  leaderboardApi,
} from "../services/api";
import type {
  PositionData,
  TradeData,
  PortfolioData,
  OptionContractData,
  LeaderboardEntryData,
  SessionEndResult,
} from "../services/api";
import {
  calculateUnrealizedPnl,
  calculatePnlPercent,
} from "../services/tradingEngine";
import { useGameStore } from "./gameStore";

interface TradingState {
  // Market data
  currentPrice: number;
  prices: Record<string, number>;
  candles: Candle[];
  selectedAsset: AssetSymbol;
  selectedInterval: TimeInterval;

  // Session data (from server)
  sessionId: number | null;
  positions: PositionData[];
  trades: TradeData[];
  balance: number;
  portfolio: PortfolioData;
  sessionActive: boolean;

  // Cooldown state
  cooldownUntil: number | null;
  drawdownLockoutUntil: number | null;
  drawdownPct: number | null;

  // Options
  activeOptions: OptionContractData[];
  optionTrades: OptionContractData[];
  isOpeningOption: boolean;
  strikes: number[];

  // Leaderboard
  leaderboardEntries: LeaderboardEntryData[];
  leaderboardPeriod: "weekly" | "all_time";
  leaderboardLoading: boolean;

  // Loading states
  isOpening: boolean;
  isClosing: string | null;

  // Actions - market data (from WS)
  setCurrentPrice: (asset: string, price: number) => void;
  setCandles: (candles: Candle[]) => void;
  setSelectedAsset: (asset: AssetSymbol) => void;
  setSelectedInterval: (interval: TimeInterval) => void;

  // Actions - session lifecycle
  loadSession: () => Promise<void>;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  resetSession: () => Promise<void>;

  // Actions - trading (async -> backend)
  openPosition: (params: {
    asset: AssetSymbol;
    side: string;
    leverage: number;
    margin: number;
    stop_loss?: number;
    take_profit?: number;
  }) => Promise<void>;
  closePosition: (positionId: string) => Promise<void>;

  // Actions - options
  loadStrikes: (asset?: string) => Promise<void>;
  openOption: (params: {
    asset: string;
    optionType: OptionType;
    strikePrice: number;
    expiry: OptionExpiry;
    premium: number;
  }) => Promise<void>;
  handleOptionSettled: (option: OptionContractData) => void;

  // Actions - leaderboard
  loadLeaderboard: (period?: "weekly" | "all_time") => Promise<void>;

  // Actions - server push sync
  syncPortfolio: (balance: number, portfolio: PortfolioData) => void;
  handleLiquidation: (trade: TradeData, positionId: string) => void;
  handleDrawdownLockout: (drawdownPct: number, lockoutUntil: number) => void;
  handleAccountBlown: (cooldownUntil: number) => void;

  // Actions - candles
  loadCandles: () => Promise<void>;
  updateLastCandle: (candle: Candle) => void;

  // Reset
  reset: () => void;
}

const initialPortfolio: PortfolioData = {
  balance: STARTING_BALANCE,
  startingBalance: STARTING_BALANCE,
  lockedMargin: 0,
  unrealizedPnl: 0,
  totalPnl: 0,
  totalTrades: 0,
  winCount: 0,
  lossCount: 0,
};

export const useTradingStore = create<TradingState>()((set, get) => ({
  currentPrice: 0,
  prices: {},
  candles: [],
  selectedAsset: "XLM",
  selectedInterval: "1m",
  sessionId: null,
  positions: [],
  trades: [],
  balance: STARTING_BALANCE,
  portfolio: initialPortfolio,
  sessionActive: false,
  cooldownUntil: null,
  drawdownLockoutUntil: null,
  drawdownPct: null,
  activeOptions: [],
  optionTrades: [],
  isOpeningOption: false,
  strikes: [],
  leaderboardEntries: [],
  leaderboardPeriod: "all_time",
  leaderboardLoading: false,
  isOpening: false,
  isClosing: null,

  setCurrentPrice: (asset, price) => {
    set((s) => ({
      prices: { ...s.prices, [asset]: price },
      currentPrice: asset === s.selectedAsset ? price : s.currentPrice,
    }));
  },

  setCandles: (candles) => set({ candles }),

  setSelectedAsset: (asset) => {
    set({ selectedAsset: asset, candles: [] });
    get().loadCandles();
  },

  setSelectedInterval: (interval) => {
    set({ selectedInterval: interval, candles: [] });
    get().loadCandles();
  },

  loadSession: async () => {
    try {
      const data = await sessionApi.getCurrent();
      set({
        sessionId: data.session.id,
        positions: data.positions,
        trades: data.trades,
        balance: data.balance,
        portfolio: data.portfolio,
        sessionActive: true,
      });
      // TODO: backend needs GET /api/options/active?session_id=X to restore active options on resume
      useGameStore.getState().navigateTo("trading");
    } catch {
      set({ sessionActive: false });
    }
  },

  startSession: async () => {
    const { session } = await sessionApi.start();
    set({
      sessionId: session.id,
      positions: [],
      trades: [],
      balance: STARTING_BALANCE,
      portfolio: initialPortfolio,
      sessionActive: true,
      activeOptions: [],
      optionTrades: [],
    });
    useGameStore.getState().navigateTo("trading");
  },

  endSession: async () => {
    const result: SessionEndResult = await sessionApi.end();
    const previousAchievements = useGameStore.getState().unlockedAchievements;

    set({
      sessionActive: false,
      sessionId: null,
      positions: [],
      trades: result.trades,
      balance: result.finalBalance,
      activeOptions: [],
    });

    // Refresh profile to get new achievements
    const { playerApi } = await import("../services/api");
    try {
      const profile = await playerApi.getProfile();
      useGameStore.getState().syncFromProfile(profile);
      const newAchievements = profile.achievements.filter(
        (a) => !previousAchievements.includes(a),
      );

      useGameStore.getState().setSessionSummary({
        session: result.session,
        trades: result.trades,
        totalPnl: result.totalPnl,
        xpEarned: result.xpEarned,
        finalBalance: result.finalBalance,
        achievementsEarned: newAchievements,
      });
    } catch {
      useGameStore.getState().setSessionSummary({
        session: result.session,
        trades: result.trades,
        totalPnl: result.totalPnl,
        xpEarned: result.xpEarned,
        finalBalance: result.finalBalance,
        achievementsEarned: [],
      });
    }

    useGameStore.getState().navigateTo("summary");
  },

  resetSession: async () => {
    const result = await sessionApi.reset();
    set({
      sessionActive: false,
      sessionId: null,
      positions: [],
      trades: [],
      balance: STARTING_BALANCE,
      portfolio: initialPortfolio,
      activeOptions: [],
      cooldownUntil: result.cooldown_until,
    });

    // Refresh profile to sync XP after penalty
    const { playerApi } = await import("../services/api");
    try {
      const profile = await playerApi.getProfile();
      useGameStore.getState().syncFromProfile(profile);
    } catch {
      /* ignore */
    }
  },

  openPosition: async (params) => {
    set({ isOpening: true });
    try {
      const result = await tradeApi.open(params);
      set((s) => ({
        positions: [...s.positions, result.position],
        balance: result.balance,
        portfolio: result.portfolio,
        isOpening: false,
      }));
    } catch (err) {
      set({ isOpening: false });
      throw err;
    }
  },

  closePosition: async (positionId) => {
    set({ isClosing: positionId });
    try {
      const result = await tradeApi.close(positionId);
      set((s) => ({
        positions: s.positions.map((p) =>
          p.id === positionId
            ? {
                ...p,
                status: "closed",
                close_price: result.trade.close_price,
                pnl: result.trade.pnl,
              }
            : p,
        ),
        trades: [...s.trades, result.trade],
        balance: result.balance,
        portfolio: result.portfolio,
        isClosing: null,
      }));
    } catch (err) {
      set({ isClosing: null });
      throw err;
    }
  },

  loadStrikes: async (asset) => {
    const selectedAsset = asset || get().selectedAsset;
    try {
      const data = await optionsApi.getStrikes(selectedAsset);
      set({ strikes: data.strikes });
    } catch (err) {
      console.error("Failed to load strikes:", err);
    }
  },

  openOption: async (params) => {
    set({ isOpeningOption: true });
    try {
      const result = await optionsApi.open({
        asset: params.asset,
        option_type: params.optionType,
        strike_price: params.strikePrice,
        expiry: params.expiry,
        premium: params.premium,
      });
      set((s) => ({
        activeOptions: [...s.activeOptions, result.option],
        balance: result.balance,
        isOpeningOption: false,
      }));
    } catch (err) {
      set({ isOpeningOption: false });
      throw err;
    }
  },

  handleOptionSettled: (option) => {
    set((s) => ({
      activeOptions: s.activeOptions.filter((o) => o.id !== option.id),
      optionTrades: [...s.optionTrades, option],
    }));
  },

  loadLeaderboard: async (period) => {
    const p = period || get().leaderboardPeriod;
    set({ leaderboardLoading: true, leaderboardPeriod: p });
    try {
      const data = await leaderboardApi.get(p);
      set({ leaderboardEntries: data.entries, leaderboardLoading: false });
    } catch {
      set({ leaderboardLoading: false });
    }
  },

  syncPortfolio: (balance, portfolio) => {
    set({ balance, portfolio });
  },

  handleLiquidation: (trade, positionId) => {
    set((s) => ({
      positions: s.positions.map((p) =>
        p.id === positionId
          ? {
              ...p,
              status: "liquidated",
              close_price: trade.close_price,
              pnl: trade.pnl,
            }
          : p,
      ),
      trades: [...s.trades, trade],
    }));
  },

  handleDrawdownLockout: (drawdownPct, lockoutUntil) => {
    set({ drawdownLockoutUntil: lockoutUntil, drawdownPct });
  },

  handleAccountBlown: (cooldownUntil) => {
    set({
      cooldownUntil,
      sessionActive: false,
      sessionId: null,
      positions: [],
    });
  },

  loadCandles: async () => {
    const { selectedAsset, selectedInterval } = get();
    try {
      const { candles } = await pricesApi.getCandles(
        selectedAsset,
        selectedInterval,
      );
      set({ candles });
      if (candles.length > 0) {
        const lastPrice = candles[candles.length - 1].close;
        set((s) => ({
          currentPrice: s.currentPrice === 0 ? lastPrice : s.currentPrice,
        }));
      }
    } catch (err) {
      console.error("Failed to load candles:", err);
    }
  },

  updateLastCandle: (candle) => {
    set((s) => {
      const candles = [...s.candles];
      if (
        candles.length > 0 &&
        candles[candles.length - 1].time === candle.time
      ) {
        candles[candles.length - 1] = candle;
      } else {
        candles.push(candle);
      }
      return { candles };
    });
  },

  reset: () =>
    set({
      positions: [],
      trades: [],
      balance: STARTING_BALANCE,
      portfolio: initialPortfolio,
      sessionActive: false,
      sessionId: null,
      cooldownUntil: null,
      drawdownLockoutUntil: null,
      drawdownPct: null,
      activeOptions: [],
      optionTrades: [],
      isOpeningOption: false,
      strikes: [],
      isOpening: false,
      isClosing: null,
    }),
}));
