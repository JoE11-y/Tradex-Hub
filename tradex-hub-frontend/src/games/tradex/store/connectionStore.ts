import { create } from 'zustand';
import { StellarWalletsKit } from '@creit-tech/stellar-wallets-kit/sdk';
import { authApi, playerApi, setToken, clearToken } from '../services/api';
import { connectWs, disconnectWs } from '../services/wsClient';
import type { PlayerProfile } from '../services/api';

interface ConnectionState {
  // Auth
  isAuthenticated: boolean;
  token: string | null;
  player: PlayerProfile | null;

  // Connection
  wsConnected: boolean;

  // Actions
  restoreSession: () => Promise<void>;
  walletLogin: () => Promise<void>;
  devLogin: (walletAddress: string) => Promise<void>;
  refreshPlayer: () => Promise<void>;
  logout: () => void;
  setWsConnected: (connected: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  isAuthenticated: false,
  token: null,
  player: null,
  wsConnected: false,

  restoreSession: async () => {
    const savedToken = sessionStorage.getItem('tradex_token');
    if (!savedToken) return;

    try {
      // Token exists in sessionStorage — try to fetch profile with it
      setToken(savedToken);
      const profile = await playerApi.getProfile();
      set({ isAuthenticated: true, token: savedToken, player: profile });
      connectWs(savedToken);
    } catch {
      // Token expired or invalid — clear it
      clearToken();
    }
  },

  walletLogin: async () => {
    // 1. Open wallet picker modal → get address
    const { address } = await StellarWalletsKit.authModal();
    if (!address) throw new Error('No wallet address returned');

    // 2. Request challenge from backend
    const { challenge } = await authApi.challenge(address);

    // 3. Sign the challenge with the wallet
    const { signedMessage } = await StellarWalletsKit.signMessage(challenge, { address });

    // 4. Verify signature on backend → get token + player
    const { token, player } = await authApi.verify(address, signedMessage);

    // 5. Complete login
    setToken(token);
    set({ isAuthenticated: true, token, player });
    connectWs(token);
  },

  devLogin: async (walletAddress: string) => {
    const { token, player } = await authApi.devLogin(walletAddress);
    setToken(token);
    set({ isAuthenticated: true, token, player });
    connectWs(token);
  },

  refreshPlayer: async () => {
    try {
      const profile = await playerApi.getProfile();
      set({ player: profile });
    } catch {
      // Non-critical: keep stale data if refresh fails
    }
  },

  logout: () => {
    clearToken();
    disconnectWs();
    set({ isAuthenticated: false, token: null, player: null, wsConnected: false });
  },

  setWsConnected: (connected: boolean) => set({ wsConnected: connected }),
}));
