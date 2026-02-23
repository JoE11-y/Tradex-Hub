import type { TradeData, PositionData, PortfolioData, OptionContractData, LeaderboardEntryData } from './api';
import { useConnectionStore } from '../store/connectionStore';

type MessageHandler = (msg: ServerWsMessage) => void;

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
const handlers = new Set<MessageHandler>();

export function onWsMessage(handler: MessageHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function connectWs(token: string): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  ws = new WebSocket(`${WS_URL}/ws?token=${token}`);

  ws.onopen = () => {
    console.log('[ws] Connected');
    useConnectionStore.getState().setWsConnected(true);
    // Subscribe to all asset prices
    send({ type: 'subscribe_prices', assets: ['XLM', 'BTC', 'ETH'] });
    // Start ping keepalive
    pingTimer = setInterval(() => send({ type: 'ping' }), 30_000);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as ServerWsMessage;
      for (const handler of handlers) {
        handler(msg);
      }
    } catch {
      console.error('[ws] Failed to parse message:', event.data);
    }
  };

  ws.onclose = () => {
    console.log('[ws] Disconnected');
    useConnectionStore.getState().setWsConnected(false);
    cleanup();
    // Auto-reconnect after 3s using fresh token from sessionStorage
    reconnectTimer = setTimeout(() => {
      const freshToken = sessionStorage.getItem('tradex_token');
      if (freshToken) connectWs(freshToken);
    }, 3000);
  };

  ws.onerror = (err) => {
    console.error('[ws] Error:', err);
  };
}

export function disconnectWs(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  cleanup();
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function send(msg: ClientWsMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function subscribeCandles(asset: string, interval: string): void {
  send({ type: 'subscribe_candles', asset, interval });
}

export function isConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

function cleanup(): void {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

// ── Message types ──

export type ClientWsMessage =
  | { type: 'subscribe_prices'; assets: string[] }
  | { type: 'unsubscribe_prices'; assets: string[] }
  | { type: 'subscribe_candles'; asset: string; interval: string }
  | { type: 'ping' };

export type ServerWsMessage =
  | { type: 'price_update'; asset: string; price: number; timestamp: number }
  | { type: 'candle_update'; asset: string; candle: { time: number; open: number; high: number; low: number; close: number; volume: number } }
  | { type: 'position_update'; position: PositionData }
  | { type: 'position_liquidated'; trade: TradeData; position_id: string }
  | { type: 'position_closed_sltp'; position_id: string; status: string; close_price: number; pnl: number; reason: string }
  | { type: 'portfolio_update'; balance: number; portfolio: PortfolioData }
  | { type: 'option_settled'; option_trade: OptionContractData; balance: number }
  | { type: 'xp_awarded'; amount: number; reason: string; total_xp: number }
  | { type: 'xp_penalty'; amount: number; reason: string; total_xp: number }
  | { type: 'level_up'; new_level: number; title: string; level_info: { level: number; title: string; xpRequired: number; maxLeverage: number } }
  | { type: 'level_down'; new_level: number; title: string }
  | { type: 'achievement_unlocked'; achievement: { id: string; name: string; description: string; xpReward: number; unlocked_at: number } }
  | { type: 'leaderboard_update'; entries: LeaderboardEntryData[] }
  | { type: 'drawdown_lockout'; drawdown_pct: number; lockout_until: number }
  | { type: 'account_blown'; cooldown_until: number; xp_penalty: number }
  | { type: 'pong'; timestamp: number }
  | { type: 'error'; message: string };
