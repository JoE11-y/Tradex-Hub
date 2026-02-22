import type { Context, Next } from 'hono';
import { getDb } from '../../db/connection';
import { AppError, ErrorCode } from '../../domain/errors';

export async function authMiddleware(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(ErrorCode.INVALID_TOKEN, 'Missing or invalid Authorization header', 401);
  }

  const token = authHeader.slice(7);
  const db = getDb();

  const row = db.query(
    'SELECT t.player_id, p.level FROM auth_tokens t JOIN players p ON p.id = t.player_id WHERE t.token = ? AND t.expires_at > ?',
  ).get(token, Date.now()) as { player_id: number; level: number } | null;

  if (!row) {
    throw new AppError(ErrorCode.TOKEN_EXPIRED, 'Token expired or invalid', 401);
  }

  c.set('playerId', row.player_id);
  c.set('playerLevel', row.level);
  await next();
}
