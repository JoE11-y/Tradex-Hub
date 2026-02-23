import { useTradingStore } from '../store/tradingStore';

export function TradeHistory() {
  const trades = useTradingStore((s) => s.trades);

  const recentTrades = [...trades].reverse().slice(0, 20);

  if (recentTrades.length === 0) {
    return (
      <div className="p-4 text-center text-sm ">
        No trade history yet
      </div>
    );
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="md:hidden space-y-2 p-2 max-h-48 overflow-y-auto">
        {recentTrades.map((trade) => (
          <div key={trade.id} className="bg-slate-800/40 rounded-lg px-3 py-2 border border-slate-700/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white">{trade.asset}</span>
              <span className={`text-[10px] font-semibold ${trade.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                {trade.side.toUpperCase()} {trade.leverage}x
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${trade.result === 'profit' ? 'bg-green-900/50 text-green-400' : trade.result === 'liquidated' ? 'bg-orange-900/50 text-orange-400' : 'bg-red-900/50 text-red-400'}`}>
                {trade.result === 'liquidated' ? 'LIQ' : trade.result.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto max-h-48 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-900/95">
            <tr className="text-slate-200 border-b border-slate-700/50">
              <th className="text-left py-2 px-3 font-medium">Asset</th>
              <th className="text-left py-2 px-2 font-medium">Side</th>
              <th className="text-right py-2 px-2 font-medium">Entry</th>
              <th className="text-right py-2 px-2 font-medium">Close</th>
              <th className="text-right py-2 px-2 font-medium">PnL</th>
              <th className="text-right py-2 px-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {recentTrades.map((trade) => (
              <tr
                key={trade.id}
                className="border-b border-slate-800/50"
              >
                <td className="py-2 px-3 text-white">{trade.asset}</td>
                <td className="py-2 px-2">
                  <span
                    className={`text-[10px] font-semibold ${trade.side === 'long' ? 'text-green-400' : 'text-red-400'
                      }`}
                  >
                    {trade.side.toUpperCase()} {trade.leverage}x
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-slate-300">
                  ${trade.entry_price.toFixed(trade.entry_price >= 100 ? 2 : 4)}
                </td>
                <td className="py-2 px-2 text-right text-slate-300">
                  ${trade.close_price.toFixed(trade.close_price >= 100 ? 2 : 4)}
                </td>
                <td
                  className={`py-2 px-2 text-right font-medium ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                >
                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${trade.result === 'profit'
                      ? 'bg-green-900/50 text-green-400'
                      : trade.result === 'liquidated'
                        ? 'bg-orange-900/50 text-orange-400'
                        : 'bg-red-900/50 text-red-400'
                      }`}
                  >
                    {trade.result === 'liquidated' ? 'LIQ' : trade.result.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
