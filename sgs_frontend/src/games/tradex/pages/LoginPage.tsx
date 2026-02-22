import { useState } from 'react';
import { useConnectionStore } from '../store/connectionStore';

export function LoginPage() {
  const walletLogin = useConnectionStore((s) => s.walletLogin);
  const devLogin = useConnectionStore((s) => s.devLogin);
  const [loading, setLoading] = useState<'wallet' | 'dev' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleWalletLogin = async () => {
    setLoading('wallet');
    setError(null);
    try {
      await walletLogin();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Wallet connection failed';
      // Don't show error if user just cancelled the modal
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('closed')) {
        setError(msg);
      }
    } finally {
      setLoading(null);
    }
  };

  const handleDevLogin = async () => {
    setLoading('dev');
    setError(null);
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let addr = 'G';
      for (let i = 0; i < 55; i++) addr += chars[Math.floor(Math.random() * chars.length)];
      await devLogin(addr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white items-center justify-center">
      <div className="max-w-sm w-full px-6">
        <div className="text-center mb-8">
          <img
            src="/tradex-logo.png"
            alt="Tradex Hub"
            className="w-32 h-32 mx-auto mb-4 drop-shadow-lg"
          />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Tradex Hub
          </h1>
          <p className="text-sm text-slate-200">Learn to trade. Prove it on-chain.</p>
          <p className="text-xs text-slate-600 mt-1">ZK-verified on Stellar Soroban</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleWalletLogin}
            disabled={loading !== null}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {loading === 'wallet' ? 'Connecting Wallet...' : 'Connect Wallet'}
          </button>

          <button
            onClick={handleDevLogin}
            disabled={loading !== null}
            className="w-full py-2.5 px-4 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-300 text-xs font-medium rounded-lg border border-slate-700/50 transition-all disabled:opacity-50"
          >
            {loading === 'dev' ? 'Connecting...' : 'Dev Mode (No Wallet)'}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center mt-3">{error}</p>
        )}

        <p className="text-[10px] text-slate-600 text-center mt-6">
          No real money involved. This is a simulated trading environment.
        </p>
      </div>
    </div>
  );
}
