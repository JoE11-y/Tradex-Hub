import { useState } from 'react';
import { useTradingStore } from '../store/tradingStore';
import { useGameStore } from '../store/gameStore';
import type { OrderSide, Leverage } from '../types';
import { MAX_POSITIONS } from '../types';

const LEVERAGE_OPTIONS: Leverage[] = [2, 5, 10];

type OrderTab = 'futures' | 'options';

export function OrderPanel() {
  const [tab, setTab] = useState<OrderTab>('futures');
  const [side, setSide] = useState<OrderSide>('long');
  const [leverage, setLeverage] = useState<Leverage>(2);
  const [marginInput, setMarginInput] = useState('100');
  const [stopLossInput, setStopLossInput] = useState('');
  const [takeProfitInput, setTakeProfitInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currentPrice = useTradingStore((s) => s.currentPrice);
  const selectedAsset = useTradingStore((s) => s.selectedAsset);
  const balance = useTradingStore((s) => s.balance);
  const positions = useTradingStore((s) => s.positions);
  const openPosition = useTradingStore((s) => s.openPosition);
  const isOpening = useTradingStore((s) => s.isOpening);

  const levelInfo = useGameStore((s) => s.levelInfo);

  const openCount = positions.filter((p) => p.status === 'open').length;
  const marginAmount = parseFloat(marginInput) || 0;
  const notionalValue = marginAmount * leverage;
  const quantity = currentPrice > 0 ? notionalValue / currentPrice : 0;
  // Fees disabled -- this is a game

  const handleSubmit = async () => {
    setError(null);

    if (currentPrice <= 0) {
      setError('Waiting for price data...');
      return;
    }

    if (marginAmount <= 0) {
      setError('Enter a valid margin amount');
      return;
    }

    if (marginAmount > balance) {
      setError('Insufficient balance');
      return;
    }

    if (openCount >= MAX_POSITIONS) {
      setError(`Max ${MAX_POSITIONS} open positions`);
      return;
    }

    if (leverage > levelInfo.maxLeverage) {
      setError(`Level ${levelInfo.level} max leverage: ${levelInfo.maxLeverage}x`);
      return;
    }

    try {
      const sl = parseFloat(stopLossInput);
      const tp = parseFloat(takeProfitInput);
      await openPosition({
        asset: selectedAsset,
        side,
        leverage,
        margin: marginAmount,
        ...(sl > 0 ? { stop_loss: sl } : {}),
        ...(tp > 0 ? { take_profit: tp } : {}),
      });
      setMarginInput('100');
      setStopLossInput('');
      setTakeProfitInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open position');
    }
  };

  const handlePercentClick = (percent: number) => {
    setMarginInput((balance * percent / 100).toFixed(2));
  };

  return (
    <div className="flex flex-col min-w-0 overflow-hidden">
      {/* Tab toggle */}
      {/* <div className="flex w-full border-b border-slate-700/50">
        <button
          onClick={() => setTab('futures')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors truncate ${tab === 'futures'
            ? 'text-white border-b-2 border-indigo-500'
            : 'text-slate-200 hover:text-slate-300'
            }`}
        >
          Futures
        </button>
        <button
          onClick={() => setTab('options')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors truncate ${tab === 'options'
            ? 'text-white border-b-2 border-indigo-500'
            : 'text-slate-200 hover:text-slate-300'
            }`}
        >
          Binary Options
        </button>
      </div> */}

      {tab === 'options' ? (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <div className="mb-3 text-3xl">🔮</div>
          <h3 className="mb-1 text-sm font-semibold text-white">Binary Options</h3>
          <p className="mb-3 text-xs text-slate-200">Call/put options with configurable strike and expiry.</p>
          <span className="px-3 py-1 text-[10px] font-bold tracking-wider rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            COMING SOON IN V2
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {/* Side toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setSide('long')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded transition-colors ${side === 'long'
                ? 'bg-green-600 text-white'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
            >
              Long
            </button>
            <button
              onClick={() => setSide('short')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded transition-colors ${side === 'short'
                ? 'bg-red-600 text-white'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
            >
              Short
            </button>
          </div>

          {/* Leverage */}
          <div>
            <label className="block mb-1 text-xs text-slate-200">Leverage</label>
            <div className="flex gap-1">
              {LEVERAGE_OPTIONS.map((lev) => (
                <button
                  key={lev}
                  onClick={() => setLeverage(lev)}
                  disabled={lev > levelInfo.maxLeverage}
                  className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${leverage === lev
                    ? 'bg-indigo-600 text-white'
                    : lev > levelInfo.maxLeverage
                      ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                >
                  {lev}x
                </button>
              ))}
            </div>
          </div>

          {/* Margin input */}
          <div>
            <label className="block mb-1 text-xs text-slate-200">
              Margin (USDT)
            </label>
            <input
              type="number"
              value={marginInput}
              onChange={(e) => setMarginInput(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm text-white border rounded bg-slate-800 border-slate-700 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-1 mt-1">
              {[10, 25, 50, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => handlePercentClick(pct)}
                  className="flex-1 py-1 text-xs transition-colors rounded text-slate-200 bg-slate-800 hover:bg-slate-700"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Stop-Loss / Take-Profit */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block mb-1 text-xs text-red-400">Stop Loss</label>
              <input
                type="number"
                value={stopLossInput}
                onChange={(e) => setStopLossInput(e.target.value)}
                onFocus={() => {
                  if (!stopLossInput && currentPrice > 0) {
                    setStopLossInput(currentPrice.toFixed(currentPrice >= 100 ? 2 : 4));
                  }
                }}
                placeholder="Optional"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-xs text-green-400">Take Profit</label>
              <input
                type="number"
                value={takeProfitInput}
                onChange={(e) => setTakeProfitInput(e.target.value)}
                onFocus={() => {
                  if (!takeProfitInput && currentPrice > 0) {
                    setTakeProfitInput(currentPrice.toFixed(currentPrice >= 100 ? 2 : 4));
                  }
                }}
                placeholder="Optional"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          {/* Order summary */}
          <div className="bg-slate-800/50 rounded p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-200">Entry Price</span>
              <span className="text-white">
                ${currentPrice > 0 ? currentPrice.toFixed(currentPrice >= 100 ? 2 : 4) : '---'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-200">Position Size</span>
              <span className="text-white">
                ${notionalValue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-200">Quantity</span>
              <span className="text-white">
                {quantity > 0 ? quantity.toFixed(quantity >= 1 ? 4 : 6) : '---'} {selectedAsset}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-200">Fees</span>
              <span className="text-green-400">None</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-center text-red-400">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={currentPrice <= 0 || marginAmount <= 0 || isOpening}
            className={`w-full py-3 text-sm font-bold rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${side === 'long'
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
          >
            {isOpening ? 'Opening...' : `Open ${side === 'long' ? 'Long' : 'Short'} ${leverage}x`}
          </button>

          {/* Balance */}
          <div className="text-xs text-center ">
            Available: ${balance.toFixed(2)} | Positions: {openCount}/{MAX_POSITIONS}
          </div>
        </div>
      )}
    </div>
  );
}
