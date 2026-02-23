import { useState, useEffect } from 'react';
import { useTradingStore } from '../store/tradingStore';

export function ActiveOptions() {
  const activeOptions = useTradingStore((s) => s.activeOptions);
  const [now, setNow] = useState(Date.now());

  // Single interval for countdown updates
  useEffect(() => {
    if (activeOptions.length === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeOptions.length]);

  if (activeOptions.length === 0) {
    return (
      <div className="p-4 text-center text-sm ">
        No active options
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {activeOptions.map((opt) => {
        const isActive = opt.status === 'active';
        const remaining = Math.max(0, opt.expires_at - now);
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        const isCall = opt.option_type === 'call';
        const isSettled = opt.status === 'settled' || opt.status === 'expired';

        return (
          <div
            key={opt.id}
            className={`rounded-lg border p-3 ${isSettled
                ? 'bg-slate-800/30 border-slate-700/30 opacity-70'
                : 'bg-slate-800/60 border-slate-700/50'
              }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">{opt.asset}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isCall
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-red-900/50 text-red-400'
                  }`}>
                  {isCall ? 'CALL' : 'PUT'}
                </span>
              </div>
              {isActive && remaining > 0 ? (
                <span className={`text-xs font-mono font-medium ${remaining < 30000 ? 'text-red-400' : 'text-slate-300'
                  }`}>
                  {mins}:{secs.toString().padStart(2, '0')}
                </span>
              ) : (
                <span className="text-[10px] font-semibold ">
                  {opt.status.toUpperCase()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div>
                <div className="">Strike</div>
                <div className="text-slate-300">${opt.strike_price.toFixed(opt.strike_price >= 100 ? 2 : 4)}</div>
              </div>
              <div>
                <div className="">Premium</div>
                <div className="text-slate-300">${opt.premium.toFixed(2)}</div>
              </div>
              <div>
                <div className="">Expiry</div>
                <div className="text-slate-300">{opt.expiry}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
