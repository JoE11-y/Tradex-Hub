import { useEffect, useMemo, useState } from 'react';
import { CandleChart } from '../components/CandleChart';
import { StreakIndicator } from '../components/StreakIndicator';
import { useEducationStore } from '../store/educationStore';
import { useGameStore } from '../store/gameStore';
import { playerApi } from '../services/api';
import type { CandleData } from '../services/api';

const ASSETS = ['BTC', 'ETH', 'XLM'] as const;
const TIMEFRAMES = ['1h', '4h'] as const;

export function PredictionPage() {
  const challenge = useEducationStore((s) => s.predictionChallenge);
  const result = useEducationStore((s) => s.predictionResult);
  const stats = useEducationStore((s) => s.predictionStats);
  const loading = useEducationStore((s) => s.predictionLoading);
  const revealedCandles = useEducationStore((s) => s.revealedCandles);
  const loadChallenge = useEducationStore((s) => s.loadPredictionChallenge);
  const submitAnswer = useEducationStore((s) => s.submitPredictionAnswer);
  const loadStats = useEducationStore((s) => s.loadPredictionStats);
  const resetPrediction = useEducationStore((s) => s.resetPrediction);
  const navigateTo = useGameStore((s) => s.navigateTo);
  const syncFromProfile = useGameStore((s) => s.syncFromProfile);

  const [selectedAsset, setSelectedAsset] = useState<string>('BTC');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1h');
  const [showRevealed, setShowRevealed] = useState(false);

  // Load initial challenge and stats
  useEffect(() => {
    loadChallenge(selectedAsset, selectedTimeframe);
    loadStats();
  }, [loadChallenge, loadStats, selectedAsset, selectedTimeframe]);

  const [revealCount, setRevealCount] = useState(0);

  // Progressive candle reveal animation
  useEffect(() => {
    if (result && revealedCandles.length > 0) {
      setRevealCount(0);
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setRevealCount(i);
        if (i >= revealedCandles.length) {
          clearInterval(interval);
          setShowRevealed(true);
        }
      }, 120);
      return () => clearInterval(interval);
    }
    setShowRevealed(false);
    setRevealCount(0);
  }, [result, revealedCandles]);

  // Combine visible + progressively revealed candles for display
  const displayCandles = useMemo((): CandleData[] => {
    if (!challenge) return [];
    if (revealCount > 0 && revealedCandles.length > 0) {
      return [...challenge.candles, ...revealedCandles.slice(0, revealCount)];
    }
    return challenge.candles;
  }, [challenge, revealCount, revealedCandles]);

  const handlePredict = (direction: 'up' | 'down' | 'sideways') => {
    if (result || loading) return;
    submitAnswer(direction);
  };

  const handleNext = () => {
    setShowRevealed(false);
    loadChallenge(selectedAsset, selectedTimeframe);
  };

  const handleEndSession = () => {
    resetPrediction();
    // Sync latest XP from server before navigating back
    playerApi.getProfile().then(syncFromProfile).catch(() => {});
    navigateTo('lobby');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/50 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('lobby')}
            className="text-xs text-slate-200 hover:text-white transition-colors"
          >
            &larr; Back
          </button>
          <h2 className="text-sm font-semibold text-white">Market Forecast</h2>

          {/* Asset selector */}
          <div className="flex items-center gap-1">
            {ASSETS.map((a) => (
              <button
                key={a}
                onClick={() => setSelectedAsset(a)}
                className={`px-2 py-0.5 text-[10px] rounded ${selectedAsset === a
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:text-white'
                  }`}
              >
                {a}
              </button>
            ))}
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-2 py-0.5 text-[10px] rounded ${selectedTimeframe === tf
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:text-white'
                  }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          {stats && (
            <div className="flex items-center gap-2 text-[10px] ">
              <span>{stats.accuracy}% acc</span>
              <span>Cred: {stats.credibility_score}%</span>
            </div>
          )}

          {/* Streak */}
          {stats && stats.current_streak > 0 && (
            <StreakIndicator
              streak={stats.current_streak}
              multiplier={stats.current_streak >= 10 ? 2 : stats.current_streak >= 6 ? 1.5 : stats.current_streak >= 3 ? 1.25 : 1}
            />
          )}

          <button
            onClick={handleEndSession}
            className="px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-900/30 hover:bg-red-900/60 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 relative">
        {challenge ? (
          <>
            <CandleChart candles={displayCandles} />
            {/* Cutoff line indicator */}
            {!showRevealed && !result && (
              <div className="absolute right-4 top-4 flex items-center gap-1.5 bg-slate-900/80 border border-slate-700 rounded px-2 py-1">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[10px] text-slate-200">Chart ends here — predict what comes next</span>
              </div>
            )}
          </>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : null}
      </div>

      {/* Prediction area */}
      <div className="px-4 py-3 border-t border-slate-800/50 shrink-0">
        {!result ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-200 text-center">Where is the price headed?</p>

            <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
              <button
                onClick={() => handlePredict('up')}
                disabled={loading || !challenge}
                className="flex-1 py-4 bg-green-600/80 hover:bg-green-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-base flex items-center justify-center gap-2 active:scale-95 hover:shadow-lg hover:shadow-green-500/20"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5m-7 7l7-7 7 7" /></svg>
                UP
              </button>
              <button
                onClick={() => handlePredict('sideways')}
                disabled={loading || !challenge}
                className="px-6 py-4 bg-slate-600/80 hover:bg-slate-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 active:scale-95"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /></svg>
                FLAT
              </button>
              <button
                onClick={() => handlePredict('down')}
                disabled={loading || !challenge}
                className="flex-1 py-4 bg-red-600/80 hover:bg-red-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-base flex items-center justify-center gap-2 active:scale-95 hover:shadow-lg hover:shadow-red-500/20"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14m7-7l-7 7-7-7" /></svg>
                DOWN
              </button>
            </div>
          </div>
        ) : (
          <div className={`max-w-lg mx-auto text-center ${result.correct ? 'animate-glow-green' : 'animate-shake'} rounded-xl p-4`}>
            <div className={`text-2xl font-bold mb-1 animate-bounce-in ${result.correct ? 'text-green-400' : 'text-red-400'}`}>
              {result.correct ? 'Correct!' : 'Wrong!'}
            </div>
            <p className="text-sm text-slate-200 mb-1 animate-fade-in-up">
              Price went <span className={result.actual_direction === 'up' ? 'text-green-400' : result.actual_direction === 'down' ? 'text-red-400' : 'text-slate-300'}>
                {result.actual_direction === 'sideways' ? 'SIDEWAYS' : result.actual_direction.toUpperCase()}
              </span> ({Math.abs(result.price_change_pct).toFixed(2)}% change)
            </p>
            {result.xp_awarded > 0 && (
              <div className="relative inline-block">
                <p className="text-sm text-indigo-400 mb-1 animate-count-pulse font-bold">
                  +{result.xp_awarded} XP{result.streak_multiplier > 1 ? ` (${result.streak_multiplier}x)` : ''}
                </p>
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-indigo-300 text-xs font-bold animate-float-up pointer-events-none">+{result.xp_awarded}</span>
              </div>
            )}
            {(result.balance_change ?? 0) !== 0 && (
              <p className={`text-xs font-medium mb-1 ${(result.balance_change ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(result.balance_change ?? 0) > 0 ? '+' : ''}${(result.balance_change ?? 0).toFixed(0)} balance
              </p>
            )}
            <p className="text-xs  mb-3 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>Credibility: {result.credibility_score}%</p>
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Next Challenge
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
