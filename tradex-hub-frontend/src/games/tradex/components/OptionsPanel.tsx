import { useState, useEffect } from 'react';
import { useTradingStore } from '../store/tradingStore';
import type { OptionType, OptionExpiry } from '../types';
import { OPTION_PAYOUT_MULTIPLIER, MAX_OPTIONS } from '../types';

const EXPIRY_OPTIONS: OptionExpiry[] = ['1m', '5m', '15m', '1h'];

export function OptionsPanel() {
  const [optionType, setOptionType] = useState<OptionType>('call');
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  const [expiry, setExpiry] = useState<OptionExpiry>('5m');
  const [premiumInput, setPremiumInput] = useState('50');
  const [error, setError] = useState<string | null>(null);

  const selectedAsset = useTradingStore((s) => s.selectedAsset);
  const currentPrice = useTradingStore((s) => s.currentPrice);
  const balance = useTradingStore((s) => s.balance);
  const strikes = useTradingStore((s) => s.strikes);
  const activeOptions = useTradingStore((s) => s.activeOptions);
  const isOpeningOption = useTradingStore((s) => s.isOpeningOption);
  const loadStrikes = useTradingStore((s) => s.loadStrikes);
  const openOption = useTradingStore((s) => s.openOption);

  const activeCount = activeOptions.filter((o) => o.status === 'active').length;
  const premium = parseFloat(premiumInput) || 0;

  // Moneyness-based suggested premium & payout estimate
  const moneyness = selectedStrike && currentPrice > 0
    ? Math.abs(selectedStrike - currentPrice) / currentPrice
    : 0;
  const isOTM = selectedStrike
    ? (optionType === 'call' ? selectedStrike > currentPrice : selectedStrike < currentPrice)
    : false;
  // Suggested premium: higher for ATM, lower for OTM
  const suggestedPremium = Math.max(10, Math.round(balance * (isOTM ? Math.max(0.005, 0.02 - moneyness * 2) : 0.02)));
  // Variable payout: deeper ITM = higher multiplier (1.5x base, up to 3x)
  const estMultiplier = Math.min(3, 1.5 + moneyness * 15);
  const maxPayout = premium * estMultiplier;

  useEffect(() => {
    loadStrikes();
  }, [selectedAsset, loadStrikes]);

  useEffect(() => {
    if (strikes.length > 0 && selectedStrike === null) {
      // Pick middle strike (closest to spot)
      const mid = Math.floor(strikes.length / 2);
      setSelectedStrike(strikes[mid]);
    }
  }, [strikes, selectedStrike]);

  const handleSubmit = async () => {
    setError(null);

    if (!selectedStrike) {
      setError('Select a strike price');
      return;
    }

    if (premium <= 0) {
      setError('Enter a valid premium');
      return;
    }

    if (premium > balance) {
      setError('Insufficient balance');
      return;
    }

    if (activeCount >= MAX_OPTIONS) {
      setError(`Max ${MAX_OPTIONS} active options`);
      return;
    }

    try {
      await openOption({
        asset: selectedAsset,
        optionType,
        strikePrice: selectedStrike,
        expiry,
        premium,
      });
      setPremiumInput('50');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open option');
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Binary options disclaimer */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded px-3 py-2">
        <p className="text-[10px] ">
          Simplified binary payoff. Real options have variable payoffs based on Black-Scholes pricing, time decay, and implied volatility.
        </p>
      </div>

      {/* Call/Put toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => setOptionType('call')}
          className={`flex-1 py-2.5 text-sm font-semibold rounded transition-colors ${optionType === 'call'
            ? 'bg-green-600 text-white'
            : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
        >
          Call
        </button>
        <button
          onClick={() => setOptionType('put')}
          className={`flex-1 py-2.5 text-sm font-semibold rounded transition-colors ${optionType === 'put'
            ? 'bg-red-600 text-white'
            : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
        >
          Put
        </button>
      </div>

      {/* Strike price picker */}
      <div>
        <label className="text-xs text-slate-200 mb-1 block">Strike Price</label>
        <div className="flex gap-1 flex-wrap">
          {strikes.slice(0, 5).map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStrike(s)}
              className={`flex-1 min-w-[60px] py-1.5 min-h-[36px] md:min-h-0 text-[10px] sm:text-xs font-medium rounded transition-colors ${selectedStrike === s
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
            >
              ${s.toFixed(s >= 100 ? 0 : 4)}
            </button>
          ))}
        </div>
        {currentPrice > 0 && (
          <div className="text-[10px]  mt-1">
            Spot: ${currentPrice.toFixed(currentPrice >= 100 ? 2 : 4)}
          </div>
        )}
      </div>

      {/* Expiry selector */}
      <div>
        <label className="text-xs text-slate-200 mb-1 block">Expiry</label>
        <div className="flex flex-wrap gap-1">
          {EXPIRY_OPTIONS.map((e) => (
            <button
              key={e}
              onClick={() => setExpiry(e)}
              className={`flex-1 py-1.5 min-h-[36px] md:min-h-0 text-xs font-medium rounded transition-colors ${expiry === e
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Premium input */}
      <div>
        <label className="text-xs text-slate-200 mb-1 block">Premium (USDT)</label>
        <input
          type="number"
          value={premiumInput}
          onChange={(e) => setPremiumInput(e.target.value)}
          placeholder="0.00"
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => setPremiumInput(String(suggestedPremium))}
          className="mt-1 text-[10px] text-indigo-400 hover:text-indigo-300"
        >
          Suggested: ${suggestedPremium} ({isOTM ? 'OTM' : 'ATM/ITM'})
        </button>
      </div>

      {/* Summary */}
      <div className="bg-slate-800/50 rounded p-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-200">Est. Payout (ITM)</span>
          <span className="text-green-400">${maxPayout.toFixed(2)} ({estMultiplier.toFixed(1)}x)</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-200">Risk</span>
          <span className="text-red-400">-${premium.toFixed(2)}</span>
        </div>
        <div className="text-[10px] ">
          Payout varies by depth ITM (1.5x-3x)
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!selectedStrike || premium <= 0 || isOpeningOption}
        className={`w-full py-3 text-sm font-bold rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${optionType === 'call'
          ? 'bg-green-600 hover:bg-green-500 text-white'
          : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
      >
        {isOpeningOption ? 'Opening...' : `Buy Binary ${optionType === 'call' ? 'Call' : 'Put'}`}
      </button>

      <div className="text-center text-xs ">
        Available: ${balance.toFixed(2)} | Options: {activeCount}/{MAX_OPTIONS}
      </div>
    </div>
  );
}
