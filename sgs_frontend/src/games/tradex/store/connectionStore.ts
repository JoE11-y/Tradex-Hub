import { create } from 'zustand';
import { StellarWalletsKit } from '@creit-tech/stellar-wallets-kit/sdk';
import { authApi, setToken, clearToken } from '../services/api';
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
  walletLogin: () => Promise<void>;
  devLogin: (walletAddress: string) => Promise<void>;
  logout: () => void;
  setWsConnected: (connected: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  isAuthenticated: false,
  token: null,
  player: null,
  wsConnected: false,

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

  logout: () => {
    clearToken();
    disconnectWs();
    set({ isAuthenticated: false, token: null, player: null, wsConnected: false });
  },

  setWsConnected: (connected: boolean) => set({ wsConnected: connected }),
}));
