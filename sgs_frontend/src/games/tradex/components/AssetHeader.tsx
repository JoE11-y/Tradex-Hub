import { useTradingStore } from '../store/tradingStore';
import type { TimeInterval } from '../types';

const TIMEFRAMES: TimeInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

export function AssetHeader() {
  const selectedAsset = useTradingStore((s) => s.selectedAsset);
  const selectedInterval = useTradingStore((s) => s.selectedInterval);
  const setSelectedInterval = useTradingStore((s) => s.setSelectedInterval);
  const currentPrice = useTradingStore((s) => s.currentPrice);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50 bg-slate-900/30 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white">
          {selectedAsset}/USDT
        </span>
        <span className={`text-xl font-bold ${currentPrice > 0 ? 'text-white' : ''}`}>
          ${currentPrice > 0 ? currentPrice.toFixed(currentPrice >= 100 ? 2 : 4) : '---'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setSelectedInterval(tf)}
            className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${selectedInterval === tf
              ? 'bg-indigo-600 text-white'
              : 'text-slate-200 hover:bg-slate-800 hover:text-slate-200'
              }`}
          >
            {tf}
          </button>
        ))}
      </div>
    </div>
  );
}
