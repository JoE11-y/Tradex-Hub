import { useEffect, useCallback, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { StellarWalletsKit } from '@creit-tech/stellar-wallets-kit/sdk';
import { defaultModules } from '@creit-tech/stellar-wallets-kit/modules/utils';
import { KitEventType } from '@creit-tech/stellar-wallets-kit/types';
import { NavBar } from './components/NavBar';
import { NotificationToast } from './components/NotificationToast';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { TradingPage } from './pages/TradingPage';
import { SummaryPage } from './pages/SummaryPage';
import { ProfilePage } from './pages/ProfilePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { PatternPage } from './pages/PatternPage';
import { PredictionPage } from './pages/PredictionPage';
import { useTradingStore } from './store/tradingStore';
import { useGameStore } from './store/gameStore';
import { useConnectionStore } from './store/connectionStore';
import { onWsMessage, disconnectWs } from './services/wsClient';
import { playerApi } from './services/api';
import { setRouteNav } from './routeNav';
import type { ServerWsMessage } from './services/wsClient';

let kitInitialized = false;
function ensureKitInit() {
  if (!kitInitialized && typeof window !== 'undefined') {
    StellarWalletsKit.init({ modules: defaultModules() });
    kitInitialized = true;
  }
}

interface TradexGameProps {
  onBack: () => void;
}

export function TradexGame({ onBack }: TradexGameProps) {
  const isAuthenticated = useConnectionStore((s) => s.isAuthenticated);
  const player = useConnectionStore((s) => s.player);
  const restoreSession = useConnectionStore((s) => s.restoreSession);
  const navigate = useNavigate();

  const loadSession = useTradingStore((s) => s.loadSession);
  const loadCandles = useTradingStore((s) => s.loadCandles);
  const setCurrentPrice = useTradingStore((s) => s.setCurrentPrice);
  const syncPortfolio = useTradingStore((s) => s.syncPortfolio);
  const handleLiquidation = useTradingStore((s) => s.handleLiquidation);
  const handleDrawdownLockout = useTradingStore((s) => s.handleDrawdownLockout);
  const handleAccountBlown = useTradingStore((s) => s.handleAccountBlown);
  const handleOptionSettled = useTradingStore((s) => s.handleOptionSettled);
  const updateLastCandle = useTradingStore((s) => s.updateLastCandle);

  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const [floatingXp, setFloatingXp] = useState<{ amount: number; key: number } | null>(null);
  const syncFromProfile = useGameStore((s) => s.syncFromProfile);
  const handleXpAwarded = useGameStore((s) => s.handleXpAwarded);
  const handleLevelUp = useGameStore((s) => s.handleLevelUp);
  const handleAchievementUnlocked = useGameStore((s) => s.handleAchievementUnlocked);
  const addNotification = useGameStore((s) => s.addNotification);

  // Restore session from sessionStorage token on mount
  useEffect(() => {
    if (!isAuthenticated) {
      restoreSession();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose navigate + playerId to Zustand store
  useEffect(() => {
    setRouteNav(navigate, player?.id ?? null);
  }, [navigate, player?.id]);

  // Handle WebSocket messages
  const handleWsMsg = useCallback((msg: ServerWsMessage) => {
    switch (msg.type) {
      case 'price_update':
        setCurrentPrice(msg.asset, msg.price);
        break;
      case 'candle_update':
        updateLastCandle(msg.candle);
        break;
      case 'portfolio_update':
        syncPortfolio(msg.balance, msg.portfolio);
        break;
      case 'position_liquidated':
        handleLiquidation(msg.trade, msg.position_id);
        addNotification({
          type: 'liquidation',
          title: 'Position Liquidated!',
          message: `Position ${msg.position_id} was liquidated`,
        });
        break;
      case 'xp_awarded':
        handleXpAwarded(msg.amount, msg.reason, msg.total_xp);
        setFloatingXp({ amount: msg.amount, key: Date.now() });
        break;
      case 'level_up':
        handleLevelUp(msg.new_level, msg.title);
        setLevelUpFlash(true);
        setTimeout(() => setLevelUpFlash(false), 2000);
        break;
      case 'achievement_unlocked':
        handleAchievementUnlocked(msg.achievement);
        break;
      case 'option_settled': {
        handleOptionSettled(msg.option_trade);
        syncPortfolio(msg.balance, useTradingStore.getState().portfolio);
        addNotification({
          type: 'info',
          title: 'Option Settled',
          message: `${msg.option_trade.asset} ${msg.option_trade.option_type.toUpperCase()} -- Balance: $${msg.balance.toFixed(2)}`,
        });
        break;
      }
      case 'drawdown_lockout':
        handleDrawdownLockout(msg.drawdown_pct, msg.lockout_until);
        addNotification({
          type: 'liquidation',
          title: 'Drawdown Limit Hit',
          message: `${msg.drawdown_pct.toFixed(1)}% drawdown — new positions locked`,
        });
        break;
      case 'account_blown':
        handleAccountBlown(msg.cooldown_until);
        addNotification({
          type: 'liquidation',
          title: 'Account Blown',
          message: `${msg.xp_penalty} XP penalty. Cooldown active.`,
        });
        break;
      case 'position_closed_sltp':
        addNotification({
          type: 'info',
          title: msg.reason === 'stop_loss' ? 'Stop-Loss Triggered' : 'Take-Profit Hit',
          message: `PnL: ${msg.pnl >= 0 ? '+' : ''}$${msg.pnl.toFixed(2)}`,
        });
        break;
      case 'xp_penalty':
        handleXpAwarded(-msg.amount, msg.reason, msg.total_xp);
        break;
      case 'level_down':
        addNotification({
          type: 'info',
          title: 'Level Down',
          message: `Now level ${msg.new_level}: ${msg.title}`,
        });
        break;
      case 'error':
        addNotification({ type: 'info', title: 'Server Error', message: msg.message });
        break;
      case 'leaderboard_update':
        useTradingStore.setState({ leaderboardEntries: msg.entries });
        break;
    }
  }, [setCurrentPrice, updateLastCandle, syncPortfolio, handleLiquidation, handleDrawdownLockout, handleAccountBlown, handleOptionSettled, handleXpAwarded, handleLevelUp, handleAchievementUnlocked, addNotification]);

  // Subscribe to WS messages
  useEffect(() => {
    const unsub = onWsMessage(handleWsMsg);
    return unsub;
  }, [handleWsMsg]);

  // Sync player profile and load session after auth
  useEffect(() => {
    if (!isAuthenticated) return;

    playerApi.getProfile().then(syncFromProfile).catch(console.error);
    loadSession().catch(console.error);
    loadCandles().catch(console.error);
  }, [isAuthenticated, syncFromProfile, loadSession, loadCandles]);

  // Refresh candles every 15s
  useEffect(() => {
    const interval = setInterval(loadCandles, 15_000);
    return () => clearInterval(interval);
  }, [loadCandles]);

  // Initialize StellarWalletsKit and subscribe to disconnect
  useEffect(() => {
    ensureKitInit();

    const unsubDisconnect = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
      useConnectionStore.getState().logout();
    });

    return () => {
      unsubDisconnect();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnectWs();
  }, []);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      <NavBar onBack={onBack} />
      <NotificationToast />

      {/* Floating XP indicator near navbar */}
      {floatingXp && (
        <div
          key={floatingXp.key}
          className="fixed top-12 right-32 z-50 text-indigo-300 text-sm font-bold animate-float-up pointer-events-none"
        >
          +{floatingXp.amount} XP
        </div>
      )}

      {/* Level up flash overlay */}
      {levelUpFlash && (
        <div className="fixed inset-0 z-40 pointer-events-none animate-level-up-flash bg-indigo-500/10 flex items-center justify-center">
          <div className="text-4xl font-bold text-indigo-300 animate-bounce-in">
            Level Up!
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full animate-fade-in-up">
          <Routes>
            <Route path="/" element={<LobbyPage />} />
            <Route path="/games/trading/:playerId" element={<TradingPage />} />
            <Route path="/games/summary/:playerId" element={<SummaryPage />} />
            <Route path="/games/profile/:playerId" element={<ProfilePage />} />
            <Route path="/games/patterns/:playerId" element={<PatternPage />} />
            <Route path="/games/forecast/:playerId" element={<PredictionPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
