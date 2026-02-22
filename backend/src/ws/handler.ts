import type { ServerWebSocket } from 'bun';
import type { ClientMessage } from './messages';
import type { WsData } from './broadcaster';
import {
  addClient,
  removeClient,
  getClient,
  setClientPlayer,
  sendToClient,
} from './broadcaster';
import { getDb } from '../db/connection';

let nextClientId = 0;

export function generateClientId(): string {
  return `ws_${Date.now()}_${nextClientId++}`;
}

export function handleWsOpen(ws: ServerWebSocket<WsData>): void {
  const clientId = ws.data.clientId;
  addClient(clientId, ws);
  console.log(`[ws] Client connected: ${clientId}`);
}

export function handleWsClose(ws: ServerWebSocket<WsData>): void {
  const clientId = ws.data.clientId;
  removeClient(clientId);
  console.log(`[ws] Client disconnected: ${clientId}`);
}

export function handleWsMessage(
  ws: ServerWebSocket<WsData>,
  raw: string | Buffer,
): void {
  const clientId = ws.data.clientId;
  const client = getClient(clientId);
  if (!client) return;

  let msg: ClientMessage;
  try {
    msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
  } catch {
    sendToClient(clientId, { type: 'error', message: 'Invalid JSON' });
    return;
  }

  // Validate message shape
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
    sendToClient(clientId, { type: 'error', message: 'Invalid message format' });
    return;
  }

  switch (msg.type) {
    case 'subscribe_prices': {
      for (const asset of msg.assets) {
        client.subscribedAssets.add(asset);
      }
      break;
    }
    case 'unsubscribe_prices': {
      for (const asset of msg.assets) {
        client.subscribedAssets.delete(asset);
      }
      break;
    }
    case 'subscribe_candles': {
      client.subscribedCandles.set(msg.asset, msg.interval);
      break;
    }
    case 'ping': {
      sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
      break;
    }
  }
}

export function authenticateWs(
  ws: ServerWebSocket<WsData>,
  token: string,
): boolean {
  const db = getDb();
  const row = db.query(
    'SELECT player_id FROM auth_tokens WHERE token = ? AND expires_at > ?',
  ).get(token, Date.now()) as { player_id: number } | null;

  if (!row) return false;

  setClientPlayer(ws.data.clientId, row.player_id);
  return true;
}
