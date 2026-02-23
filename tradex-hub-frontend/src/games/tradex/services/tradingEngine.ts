/**
 * Frontend-only PnL helpers for real-time display between server pushes.
 * The backend is the source of truth — these are for UI interpolation only.
 */

import type { PositionData } from './api';

const LIQUIDATION_THRESHOLD = 0.9;

export function calculateUnrealizedPnl(
  position: PositionData,
  currentPrice: number,
): number {
  const direction = position.side === 'long' ? 1 : -1;
  const priceDiff = (currentPrice - position.entry_price) * direction;
  return priceDiff * position.quantity;
}

export function calculatePnlPercent(
  position: PositionData,
  currentPrice: number,
): number {
  const pnl = calculateUnrealizedPnl(position, currentPrice);
  return (pnl / position.margin) * 100;
}

export function calculateLiquidationPrice(
  entryPrice: number,
  side: string,
  leverage: number,
): number {
  const movePercent = LIQUIDATION_THRESHOLD / leverage;
  return side === 'long'
    ? entryPrice * (1 - movePercent)
    : entryPrice * (1 + movePercent);
}
