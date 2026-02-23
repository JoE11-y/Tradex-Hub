import { useEffect, useRef, useState } from 'react';
import { TickerBar } from '../components/TickerBar';
import { AssetHeader } from '../components/AssetHeader';
import { TradingChart } from '../components/TradingChart';
import { BottomTabs } from '../components/BottomTabs';
import { PositionsList } from '../components/PositionsList';
import { TradeHistory } from '../components/TradeHistory';
import { AchievementGrid } from '../components/AchievementGrid';
import { PortfolioWidget } from '../components/PortfolioWidget';
import { OrderPanel } from '../components/OrderPanel';
import { useTradingStore } from '../store/tradingStore';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TradingPage() {
  const endSession = useTradingStore((s) => s.endSession);
  const sessionId = useTradingStore((s) => s.sessionId);
  const candles = useTradingStore((s) => s.candles);
  const loadCandles = useTradingStore((s) => s.loadCandles);
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  // Clear stale candles and fetch fresh data on mount
  useEffect(() => {
    useTradingStore.setState({ candles: [] });
    loadCandles();
  }, [loadCandles]);

  // Session timer
  useEffect(() => {
    if (!sessionId) return;
    startTimeRef.current = Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const bottomTabs = [
    { label: 'Positions', content: <PositionsList /> },
    { label: 'History', content: <TradeHistory /> },
    { label: 'Achievements', content: <AchievementGrid compact /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <TickerBar />

      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Left: Chart + bottom tabs */}
        <div className="flex-1 flex flex-col min-w-0">
          <AssetHeader />
          <div className="flex-1 min-h-0 h-[50vh] md:h-auto">
            <TradingChart />
          </div>
          <div className="h-32 md:h-48 shrink-0 border-t border-slate-700/50">
            <BottomTabs tabs={bottomTabs} />
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-full md:w-[500px] md:shrink-0 border-t md:border-t-0 md:border-l border-slate-700/50 flex flex-col overflow-hidden bg-slate-900/50">
          {/* End Session bar at top of sidebar */}
          <div className="border-b border-slate-700/50 p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-slate-200 font-mono">{formatTimer(elapsed)}</span>
              </div>
              {sessionId && (
                <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
                  Session #{sessionId}
                </span>
              )}
            </div>
            <button
              onClick={() => endSession().catch(console.error)}
              className="px-4 py-1.5 text-xs font-semibold text-red-400 bg-red-900/30 hover:bg-red-900/60 border border-red-500/30 hover:border-red-500/50 rounded transition-all active:scale-[0.97]"
            >
              End Session
            </button>
          </div>

          <div className="border-b border-slate-700/50">
            <PortfolioWidget />
          </div>
          <div className="flex-1 overflow-y-auto">
            <OrderPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
