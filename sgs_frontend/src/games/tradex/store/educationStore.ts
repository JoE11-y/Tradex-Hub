import { create } from 'zustand';
import {
  patternApi,
  predictionApi,
} from '../services/api';
import type {
  CandleData,
  PatternChallengeData,
  PatternAnswerResult,
  PatternStatsData,
  PredictionChallengeData,
  PredictionAnswerResult,
  PredictionStatsData,
} from '../services/api';

interface EducationState {
  // Pattern module
  patternChallenge: PatternChallengeData | null;
  patternResult: PatternAnswerResult | null;
  patternStats: PatternStatsData | null;
  patternLoading: boolean;
  patternTimerStart: number;

  // Prediction module
  predictionChallenge: PredictionChallengeData | null;
  predictionResult: PredictionAnswerResult | null;
  predictionStats: PredictionStatsData | null;
  predictionLoading: boolean;
  revealedCandles: CandleData[];

  // Actions - Pattern
  loadPatternChallenge: () => Promise<void>;
  submitPatternAnswer: (answer: string) => Promise<PatternAnswerResult | null>;
  loadPatternStats: () => Promise<void>;

  // Actions - Prediction
  loadPredictionChallenge: (asset?: string, timeframe?: string) => Promise<void>;
  submitPredictionAnswer: (direction: 'up' | 'down' | 'sideways', magnitude?: string) => Promise<PredictionAnswerResult | null>;
  loadPredictionStats: () => Promise<void>;

  // Reset
  resetPattern: () => void;
  resetPrediction: () => void;
}

export const useEducationStore = create<EducationState>()((set, get) => ({
  // Pattern initial state
  patternChallenge: null,
  patternResult: null,
  patternStats: null,
  patternLoading: false,
  patternTimerStart: 0,

  // Prediction initial state
  predictionChallenge: null,
  predictionResult: null,
  predictionStats: null,
  predictionLoading: false,
  revealedCandles: [],

  // ── Pattern actions ──

  loadPatternChallenge: async () => {
    set({ patternLoading: true, patternResult: null });
    try {
      const challenge = await patternApi.getChallenge();
      set({
        patternChallenge: challenge,
        patternLoading: false,
        patternTimerStart: Date.now(),
      });
    } catch (err) {
      console.error('[educationStore] Failed to load pattern challenge:', err);
      set({ patternLoading: false });
    }
  },

  submitPatternAnswer: async (answer: string) => {
    const { patternChallenge, patternTimerStart } = get();
    if (!patternChallenge) return null;

    const timeMs = Date.now() - patternTimerStart;
    set({ patternLoading: true });
    try {
      const result = await patternApi.submitAnswer(
        patternChallenge.challenge_id,
        answer,
        timeMs,
      );
      set({ patternResult: result, patternLoading: false });
      return result;
    } catch (err) {
      console.error('[educationStore] Failed to submit pattern answer:', err);
      set({ patternLoading: false });
      return null;
    }
  },

  loadPatternStats: async () => {
    try {
      const stats = await patternApi.getStats();
      set({ patternStats: stats });
    } catch (err) {
      console.error('[educationStore] Failed to load pattern stats:', err);
    }
  },

  // ── Prediction actions ──

  loadPredictionChallenge: async (asset?: string, timeframe?: string) => {
    set({ predictionLoading: true, predictionResult: null, revealedCandles: [] });
    try {
      const challenge = await predictionApi.getChallenge(asset, timeframe);
      set({
        predictionChallenge: challenge,
        predictionLoading: false,
      });
    } catch (err) {
      console.error('[educationStore] Failed to load prediction challenge:', err);
      set({ predictionLoading: false });
    }
  },

  submitPredictionAnswer: async (direction: 'up' | 'down' | 'sideways', magnitude?: string) => {
    const { predictionChallenge } = get();
    if (!predictionChallenge) return null;

    set({ predictionLoading: true });
    try {
      const result = await predictionApi.submitAnswer(
        predictionChallenge.challenge_id,
        direction,
        magnitude,
      );
      set({
        predictionResult: result,
        revealedCandles: result.hidden_candles,
        predictionLoading: false,
      });
      return result;
    } catch (err) {
      console.error('[educationStore] Failed to submit prediction answer:', err);
      set({ predictionLoading: false });
      return null;
    }
  },

  loadPredictionStats: async () => {
    try {
      const stats = await predictionApi.getStats();
      set({ predictionStats: stats });
    } catch (err) {
      console.error('[educationStore] Failed to load prediction stats:', err);
    }
  },

  // ── Reset ──

  resetPattern: () => set({
    patternChallenge: null,
    patternResult: null,
    patternLoading: false,
    patternTimerStart: 0,
  }),

  resetPrediction: () => set({
    predictionChallenge: null,
    predictionResult: null,
    predictionLoading: false,
    revealedCandles: [],
  }),
}));
