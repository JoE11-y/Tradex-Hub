import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { priceHandlers } from './handlers/prices';
import { authHandlers } from './handlers/auth';
import { sessionHandlers } from './handlers/session';
import { playerHandlers } from './handlers/player';
import { tradingHandlers } from './handlers/trading';
import { optionsHandlers } from './handlers/options';
import { leaderboardHandlers } from './handlers/leaderboard';
import { badgeHandlers } from './handlers/badge';
import { patternHandlers } from './handlers/patterns';
import { predictionHandlers } from './handlers/predictions';
import { authMiddleware } from './middleware/auth';
import { AppError } from '../domain/errors';
import { CONFIG } from '../config';

export function createApp(): Hono {
  const app = new Hono();

  // Global middleware
  app.use('*', cors({
    origin: CONFIG.DEV_MODE ? '*' : CONFIG.CORS_ORIGIN,
  }));

  // Error handler
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.code, message: err.message }, err.status as 400);
    }
    console.error('[api] Unhandled error:', err);
    return c.json({ error: 'INTERNAL_ERROR', message: 'Internal server error' }, 500);
  });

  // Health check
  app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

  // Public: prices
  app.get('/api/prices/current', priceHandlers.current);
  app.get('/api/prices/candles', priceHandlers.candles);

  // Public: auth
  app.post('/api/auth/challenge', authHandlers.challenge);
  app.post('/api/auth/verify', authHandlers.verify);
  app.post('/api/auth/dev-login', authHandlers.devLogin);

  // Protected routes
  const protected_ = new Hono();
  protected_.use('*', authMiddleware);

  // Player
  protected_.get('/player/profile', playerHandlers.getProfile);
  protected_.patch('/player/profile', playerHandlers.updateProfile);

  // Sessions
  protected_.post('/session/start', sessionHandlers.start);
  protected_.get('/session/current', sessionHandlers.current);
  protected_.post('/session/end', sessionHandlers.end);
  protected_.post('/session/reset', sessionHandlers.reset);
  protected_.get('/session/history', sessionHandlers.history);

  // Trading
  protected_.post('/trade/open', tradingHandlers.open);
  protected_.post('/trade/close', tradingHandlers.close);

  // Options
  protected_.get('/options/strikes', optionsHandlers.strikes);
  protected_.post('/options/open', optionsHandlers.open);

  // Leaderboard
  protected_.get('/leaderboard', leaderboardHandlers.get);

  // Badges
  protected_.get('/badges/eligible', badgeHandlers.eligible);
  protected_.post('/badges/prepare', badgeHandlers.prepare);
  protected_.post('/badges/mint', badgeHandlers.mint);
  protected_.get('/badges/mine', badgeHandlers.mine);

  // Patterns (education module)
  protected_.post('/patterns/challenge', patternHandlers.challenge);
  protected_.post('/patterns/answer', patternHandlers.answer);
  protected_.get('/patterns/stats', patternHandlers.stats);

  // Predictions (education module)
  protected_.post('/predictions/challenge', predictionHandlers.challenge);
  protected_.post('/predictions/answer', predictionHandlers.answer);
  protected_.get('/predictions/stats', predictionHandlers.stats);

  app.route('/api', protected_);

  // 404 catch-all
  app.notFound((c) => c.json({ error: 'NOT_FOUND', message: 'Endpoint not found' }, 404));

  return app;
}
