import { useEffect, useState } from 'react';
import { CandleChart } from '../components/CandleChart';
import { StreakIndicator } from '../components/StreakIndicator';
import { useEducationStore } from '../store/educationStore';
import { useGameStore } from '../store/gameStore';
import { playerApi } from '../services/api';

const PATTERN_LABELS: Record<string, string> = {
  uptrend: 'Uptrend',
  downtrend: 'Downtrend',
  support: 'Support Level',
  resistance: 'Resistance Level',
  double_top: 'Double Top',
  double_bottom: 'Double Bottom',
  bull_flag: 'Bull Flag',
  bear_flag: 'Bear Flag',
  head_and_shoulders: 'Head & Shoulders',
  inv_head_and_shoulders: 'Inverse H&S',
  ascending_triangle: 'Ascending Triangle',
  descending_triangle: 'Descending Triangle',
};

export function PatternPage() {
  const challenge = useEducationStore((s) => s.patternChallenge);
  const result = useEducationStore((s) => s.patternResult);
  const stats = useEducationStore((s) => s.patternStats);
  const loading = useEducationStore((s) => s.patternLoading);
  const timerStart = useEducationStore((s) => s.patternTimerStart);
  const loadChallenge = useEducationStore((s) => s.loadPatternChallenge);
  const submitAnswer = useEducationStore((s) => s.submitPatternAnswer);
  const loadStats = useEducationStore((s) => s.loadPatternStats);
  const resetPattern = useEducationStore((s) => s.resetPattern);
  const navigateTo = useGameStore((s) => s.navigateTo);
  const syncFromProfile = useGameStore((s) => s.syncFromProfile);

  const [elapsed, setElapsed] = useState(0);

  // Load initial challenge and stats
  useEffect(() => {
    loadChallenge();
    loadStats();
  }, [loadChallenge, loadStats]);

  // Timer
  useEffect(() => {
    if (!challenge || result) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timerStart) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [challenge, result, timerStart]);

  const handleAnswer = (answer: string) => {
    if (result || loading) return;
    submitAnswer(answer);
  };

  const handleNext = () => {
    setElapsed(0);
    loadChallenge();
  };

  const handleEndSession = () => {
    resetPattern();
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
          <h2 className="text-sm font-semibold text-white">Pattern Recognition</h2>
          {challenge && (
            <span className={`text-[10px] px-2 py-0.5 rounded ${challenge.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
              challenge.difficulty === 'medium' ? 'bg-cyan-500/20 text-cyan-400' :
                'bg-red-500/20 text-red-400'
              }`}>
              {challenge.difficulty.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          {challenge && !result && (
            <span className="text-xs text-slate-200 font-mono">{elapsed}s</span>
          )}

          {/* Stats */}
          {stats && (
            <div className="flex items-center gap-2 text-[10px] ">
              <span>{stats.accuracy}% acc</span>
              <span>{stats.total} done</span>
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
      <div className="flex-1 min-h-0">
        {challenge ? (
          <CandleChart
            candles={challenge.candles}
            highlightStart={challenge.highlight_start}
            highlightEnd={challenge.highlight_end}
          />
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : null}
      </div>

      {/* Answer area */}
      <div className="px-4 py-3 border-t border-slate-800/50 shrink-0">
        {!result ? (
          <>
            <p className="text-xs text-slate-200 mb-2 text-center">
              What pattern do you see in this chart?
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
              {challenge?.options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  disabled={loading}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
                >
                  {PATTERN_LABELS[option] || option}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className={`max-w-lg mx-auto text-center ${result.correct ? 'animate-glow-green' : 'animate-shake'} rounded-xl p-4`}>
            {/* Result */}
            <div className={`text-2xl font-bold mb-1 animate-bounce-in ${result.correct ? 'text-green-400' : 'text-red-400'}`}>
              {result.correct ? 'Correct!' : 'Wrong!'}
            </div>
            {!result.correct && (
              <p className="text-sm text-slate-200 mb-1 animate-fade-in-up">
                The answer was: <span className="text-white font-medium">{PATTERN_LABELS[result.correct_answer] || result.correct_answer}</span>
              </p>
            )}
            {result.xp_awarded > 0 && (
              <div className="relative inline-block">
                <p className="text-sm text-indigo-400 mb-1 animate-count-pulse font-bold">+{result.xp_awarded} XP{result.streak_multiplier > 1 ? ` (${result.streak_multiplier}x)` : ''}</p>
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-indigo-300 text-xs font-bold animate-float-up pointer-events-none">+{result.xp_awarded}</span>
              </div>
            )}
            {(result.balance_change ?? 0) !== 0 && (
              <p className={`text-xs font-medium mb-1 ${(result.balance_change ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(result.balance_change ?? 0) > 0 ? '+' : ''}${(result.balance_change ?? 0).toFixed(0)} balance
              </p>
            )}
            {result.description && (
              <p className="text-xs  mb-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>{result.description}</p>
            )}
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
