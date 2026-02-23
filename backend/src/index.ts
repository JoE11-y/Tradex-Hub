import { CONFIG } from './config';
import { initDb, closeDb } from './db/connection';
import { playerRepo } from './db/repositories/playerRepo';
import { createApp } from './api/routes';
import { startPricePolling, stopPricePolling } from './services/priceService';
import { initLiquidationLoop } from './services/tradingEngine';
import { startOptionSettlement, stopOptionSettlement } from './services/optionsEngine';
import { startLeaderboardRebuild, stopLeaderboardRebuild } from './services/leaderboardService';
import { patternService } from './services/patternService';
import { sessionManager } from './services/sessionManager';
import {
  handleWsOpen,
  handleWsClose,
  handleWsMessage,
  generateClientId,
  authenticateWs,
} from './ws/handler';
import { sendToClient } from './ws/broadcaster';
import type { WsData } from './ws/broadcaster';

const app = createApp();

// Module-level map for pending WS auth tokens (replaces globalThis hack)
const pendingWsTokens = new Map<string, string>();

function start(): void {
  // Initialize database
  initDb();

  // Seed dev players so they get stable IDs (1 and 2) on a fresh DB
  if (CONFIG.DEV_MODE) {
    const p1 = process.env.VITE_DEV_PLAYER1_ADDRESS;
    const p2 = process.env.VITE_DEV_PLAYER2_ADDRESS;
    if (p1 && !playerRepo.findByWallet(p1)) {
      const player = playerRepo.create(p1, 'Dev Player 1');
      console.log(`[seed] Created dev player 1: id=${player.id} wallet=${p1.slice(0, 8)}...`);
    }
    if (p2 && !playerRepo.findByWallet(p2)) {
      const player = playerRepo.create(p2, 'Dev Player 2');
      console.log(`[seed] Created dev player 2: id=${player.id} wallet=${p2.slice(0, 8)}...`);
    }
  }

  // Initialize data
  patternService.init();

  // Cleanup stale sessions on startup
  sessionManager.cleanupStaleSessions();

  // Start background services
  startPricePolling();
  initLiquidationLoop();
  startOptionSettlement();
  startLeaderboardRebuild();

  // Hourly stale session cleanup
  setInterval(() => {
    try { sessionManager.cleanupStaleSessions(); } catch (err) {
      console.error('[server] Stale session cleanup error:', err);
    }
  }, 60 * 60 * 1000);

  // Start server with WebSocket support
  const server = Bun.serve<WsData>({
    port: CONFIG.PORT,
    fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket upgrade
      if (url.pathname === '/ws') {
        const token = url.searchParams.get('token');
        const clientId = generateClientId();

        const success = server.upgrade(req, {
          data: { clientId },
        });

        if (!success) {
          return new Response('WebSocket upgrade failed', { status: 400 });
        }

        // Store token for auth in open handler
        if (token) {
          pendingWsTokens.set(clientId, token);
        }

        return undefined;
      }

      // HTTP requests handled by Hono
      return app.fetch(req, { IP: server.requestIP(req) });
    },
    websocket: {
      open(ws) {
        handleWsOpen(ws);

        // Authenticate if token was provided
        const token = pendingWsTokens.get(ws.data.clientId);
        if (token) {
          pendingWsTokens.delete(ws.data.clientId);
          const authed = authenticateWs(ws, token);
          if (!authed) {
            sendToClient(ws.data.clientId, { type: 'error', message: 'Authentication failed' });
          }
        }
      },
      message(ws, message) {
        handleWsMessage(ws, message);
      },
      close(ws) {
        handleWsClose(ws);
      },
    },
  });

  console.log(`
╔═══════════════════════════════════════╗
║       Tradex Backend Server           ║
╠═══════════════════════════════════════╣
║  HTTP:  http://localhost:${CONFIG.PORT}        ║
║  WS:    ws://localhost:${CONFIG.PORT}/ws       ║
║  Mode:  ${CONFIG.DEV_MODE ? 'Development' : 'Production'}                ║
╚═══════════════════════════════════════╝
  `);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[server] Shutting down...');
  stopPricePolling();
  stopOptionSettlement();
  stopLeaderboardRebuild();
  closeDb();
  process.exit(0);
});

start();
