import { useState } from 'react';
import { useConnectionStore } from '../store/connectionStore';

const DEV_PLAYER1_ADDRESS = import.meta.env.VITE_DEV_PLAYER1_ADDRESS as string | undefined;
const DEV_PLAYER2_ADDRESS = import.meta.env.VITE_DEV_PLAYER2_ADDRESS as string | undefined;

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
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('closed')) {
        setError(msg);
      }
    } finally {
      setLoading(null);
    }
  };

  const handleDevLogin = async (address: string) => {
    setLoading('dev');
    setError(null);
    try {
      await devLogin(address);
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

          {DEV_PLAYER1_ADDRESS && (
            <button
              onClick={() => handleDevLogin(DEV_PLAYER1_ADDRESS)}
              disabled={loading !== null}
              className="w-full py-2.5 px-4 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-300 text-xs font-medium rounded-lg border border-slate-700/50 transition-all disabled:opacity-50"
            >
              {loading === 'dev' ? 'Connecting...' : `Dev Player 1 (${DEV_PLAYER1_ADDRESS.slice(0, 6)}...)`}
            </button>
          )}

          {DEV_PLAYER2_ADDRESS && (
            <button
              onClick={() => handleDevLogin(DEV_PLAYER2_ADDRESS)}
              disabled={loading !== null}
              className="w-full py-2.5 px-4 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-300 text-xs font-medium rounded-lg border border-slate-700/50 transition-all disabled:opacity-50"
            >
              {loading === 'dev' ? 'Connecting...' : `Dev Player 2 (${DEV_PLAYER2_ADDRESS.slice(0, 6)}...)`}
            </button>
          )}
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
