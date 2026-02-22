import type { ServerWebSocket } from 'bun';
import type { ServerMessage } from './messages';
import type { AssetSymbol } from '../domain/types';

export interface WsClient {
  ws: ServerWebSocket<WsData>;
  playerId: number | null;
  subscribedAssets: Set<AssetSymbol>;
  subscribedCandles: Map<AssetSymbol, string>; // asset → interval
}

export interface WsData {
  clientId: string;
}

const clients = new Map<string, WsClient>();

export function addClient(clientId: string, ws: ServerWebSocket<WsData>): WsClient {
  const client: WsClient = {
    ws,
    playerId: null,
    subscribedAssets: new Set(),
    subscribedCandles: new Map(),
  };
  clients.set(clientId, client);
  return client;
}

export function removeClient(clientId: string): void {
  clients.delete(clientId);
}

export function getClient(clientId: string): WsClient | undefined {
  return clients.get(clientId);
}

export function setClientPlayer(clientId: string, playerId: number): void {
  const client = clients.get(clientId);
  if (client) client.playerId = playerId;
}

export function sendToClient(clientId: string, message: ServerMessage): void {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === 1) {
    client.ws.send(JSON.stringify(message));
  }
}

export function sendToPlayer(playerId: number, message: ServerMessage): void {
  for (const client of clients.values()) {
    if (client.playerId === playerId && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message));
    }
  }
}

export function broadcastPriceUpdate(asset: AssetSymbol, price: number): void {
  const msg = JSON.stringify({
    type: 'price_update',
    asset,
    price,
    timestamp: Date.now(),
  });

  for (const client of clients.values()) {
    if (client.subscribedAssets.has(asset) && client.ws.readyState === 1) {
      client.ws.send(msg);
    }
  }
}

export function broadcastToAll(message: ServerMessage): void {
  const msg = JSON.stringify(message);
  for (const client of clients.values()) {
    if (client.ws.readyState === 1) {
      client.ws.send(msg);
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}

export function getClientsForPlayer(playerId: number): WsClient[] {
  const result: WsClient[] = [];
  for (const client of clients.values()) {
    if (client.playerId === playerId) result.push(client);
  }
  return result;
}

export function broadcastCandleUpdate(asset: AssetSymbol, candle: import('../domain/types').Candle): void {
  const msg = JSON.stringify({ type: 'candle_update', asset, candle });
  for (const client of clients.values()) {
    if (client.subscribedCandles.has(asset) && client.ws.readyState === 1) {
      client.ws.send(msg);
    }
  }
}

export function hasCandleSubscribers(asset: AssetSymbol): boolean {
  for (const client of clients.values()) {
    if (client.subscribedCandles.has(asset)) return true;
  }
  return false;
}
