/**
 * Frontend-only option helpers for display.
 * Options engine runs server-side — these are UI formatting only.
 */

export function getTimeRemaining(expiresAt: number): number {
  return Math.max(0, expiresAt - Date.now());
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '00:00';

  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
