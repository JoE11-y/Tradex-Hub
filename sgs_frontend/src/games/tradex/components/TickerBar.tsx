import { useTradingStore } from '../store/tradingStore';
import { SUPPORTED_ASSETS } from '../types';
import type { AssetSymbol } from '../types';

export function TickerBar() {
  const selectedAsset = useTradingStore((s) => s.selectedAsset);
  const setSelectedAsset = useTradingStore((s) => s.setSelectedAsset);
  const prices = useTradingStore((s) => s.prices);

  return (
    <div className="flex items-stretch bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 shrink-0">
      {SUPPORTED_ASSETS.map((asset) => {
        const price = prices[asset.symbol] || 0;
        const isSelected = selectedAsset === asset.symbol;

        return (
          <button
            key={asset.symbol}
            onClick={() => setSelectedAsset(asset.symbol as AssetSymbol)}
            className={`flex-1 px-4 py-2.5 flex items-center justify-center gap-3 transition-colors ${isSelected
                ? 'bg-slate-800/60 border-b-2 border-indigo-500'
                : 'hover:bg-slate-800/30 border-b-2 border-transparent'
              }`}
          >
            <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
              {asset.symbol}
            </span>
            <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-200'}`}>
              ${price > 0 ? price.toFixed(price >= 100 ? 2 : 4) : '---'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
