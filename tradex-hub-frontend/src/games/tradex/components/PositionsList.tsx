import { useTradingStore } from '../store/tradingStore';
import { calculateUnrealizedPnl, calculatePnlPercent } from '../services/tradingEngine';

export function PositionsList() {
  const positions = useTradingStore((s) => s.positions);
  const prices = useTradingStore((s) => s.prices);
  const closePosition = useTradingStore((s) => s.closePosition);
  const isClosing = useTradingStore((s) => s.isClosing);

  const openPositions = positions.filter((p) => p.status === 'open');

  const handleClose = async (positionId: string) => {
    try {
      await closePosition(positionId);
    } catch (err) {
      console.error('Failed to close position:', err);
    }
  };

  if (openPositions.length === 0) {
    return (
      <div className="p-4 text-center text-sm ">
        No open positions
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-200 border-b border-slate-700/50">
            <th className="text-left py-2 px-3 font-medium">Asset</th>
            <th className="text-left py-2 px-2 font-medium">Side</th>
            <th className="text-right py-2 px-2 font-medium">Size</th>
            <th className="text-right py-2 px-2 font-medium">Entry</th>
            <th className="text-right py-2 px-2 font-medium">Liq. Price</th>
            <th className="text-right py-2 px-2 font-medium">SL</th>
            <th className="text-right py-2 px-2 font-medium">TP</th>
            <th className="text-right py-2 px-2 font-medium">PnL</th>
            <th className="text-right py-2 px-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {openPositions.map((pos) => {
            const assetPrice = prices[pos.asset] || 0;
            const pnl = calculateUnrealizedPnl(pos, assetPrice);
            const pnlPct = calculatePnlPercent(pos, assetPrice);
            const isProfit = pnl >= 0;
            const closing = isClosing === pos.id;

            return (
              <tr
                key={pos.id}
                className="border-b border-slate-800/50 hover:bg-slate-800/30"
              >
                <td className="py-2.5 px-3 text-white font-medium">
                  {pos.asset}
                </td>
                <td className="py-2.5 px-2">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${pos.side === 'long'
                      ? 'bg-green-900/50 text-green-400'
                      : 'bg-red-900/50 text-red-400'
                      }`}
                  >
                    {pos.side.toUpperCase()} {pos.leverage}x
                  </span>
                </td>
                <td className="py-2.5 px-2 text-right text-slate-300">
                  ${pos.margin.toFixed(2)}
                </td>
                <td className="py-2.5 px-2 text-right text-slate-300">
                  ${pos.entry_price.toFixed(pos.entry_price >= 100 ? 2 : 4)}
                </td>
                <td className="py-2.5 px-2 text-right text-orange-400">
                  ${pos.liquidation_price.toFixed(pos.liquidation_price >= 100 ? 2 : 4)}
                </td>
                <td className="py-2.5 px-2 text-right text-red-400">
                  {pos.stop_loss ? `$${pos.stop_loss.toFixed(pos.stop_loss >= 100 ? 2 : 4)}` : '—'}
                </td>
                <td className="py-2.5 px-2 text-right text-green-400">
                  {pos.take_profit ? `$${pos.take_profit.toFixed(pos.take_profit >= 100 ? 2 : 4)}` : '—'}
                </td>
                <td
                  className={`py-2.5 px-2 text-right font-medium ${isProfit ? 'text-green-400' : 'text-red-400'
                    }`}
                >
                  <div>{isProfit ? '+' : ''}${pnl.toFixed(2)}</div>
                  <div className="text-[10px] opacity-75">
                    {isProfit ? '+' : ''}{pnlPct.toFixed(1)}%
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    onClick={() => handleClose(pos.id)}
                    disabled={closing}
                    className="px-2.5 py-1 text-[10px] font-semibold bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    {closing ? '...' : 'Close'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
