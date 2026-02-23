import { CONFIG } from "./config";
import { initDb, closeDb } from "./db/connection";
import { playerRepo } from "./db/repositories/playerRepo";
import { createApp } from "./api/routes";
import { startPricePolling, stopPricePolling } from "./services/priceService";
import { initLiquidationLoop } from "./services/tradingEngine";
import {
  startOptionSettlement,
  stopOptionSettlement,
} from "./services/optionsEngine";
import {
  startLeaderboardRebuild,
  stopLeaderboardRebuild,
} from "./services/leaderboardService";
import { patternService } from "./services/patternService";
import { sessionManager } from "./services/sessionManager";
import {
  handleWsOpen,
  handleWsClose,
  handleWsMessage,
  generateClientId,
  authenticateWs,
} from "./ws/handler";
import { sendToClient } from "./ws/broadcaster";
import type { WsData } from "./ws/broadcaster";

const app = createApp();

const pendingWsTokens = new Map<string, string>();

// ✅ Allowed frontend origins
const allowedOrigins = [
  "https://tradex-hub.vercel.app",
  "http://localhost:5173",
];

function addCorsHeaders(req: Request, res: Response) {
  const origin = req.headers.get("origin");

  if (origin && allowedOrigins.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS",
    );
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
  }

  return res;
}

function start(): void {
  initDb();

  if (CONFIG.DEV_MODE) {
    const p1 = process.env.VITE_DEV_PLAYER1_ADDRESS;
    const p2 = process.env.VITE_DEV_PLAYER2_ADDRESS;

    if (p1 && !playerRepo.findByWallet(p1)) {
      const player = playerRepo.create(p1, "Dev Player 1");
      console.log(
        `[seed] Created dev player 1: id=${player.id} wallet=${p1.slice(
          0,
          8,
        )}...`,
      );
    }

    if (p2 && !playerRepo.findByWallet(p2)) {
      const player = playerRepo.create(p2, "Dev Player 2");
      console.log(
        `[seed] Created dev player 2: id=${player.id} wallet=${p2.slice(
          0,
          8,
        )}...`,
      );
    }
  }

  patternService.init();
  sessionManager.cleanupStaleSessions();

  startPricePolling();
  initLiquidationLoop();
  startOptionSettlement();
  startLeaderboardRebuild();

  setInterval(
    () => {
      try {
        sessionManager.cleanupStaleSessions();
      } catch (err) {
        console.error("[server] Stale session cleanup error:", err);
      }
    },
    60 * 60 * 1000,
  );

  const server = Bun.serve<WsData>({
    port: CONFIG.PORT,

    async fetch(req, server) {
      const url = new URL(req.url);

      // ✅ Handle CORS preflight
      if (req.method === "OPTIONS") {
        const res = new Response(null, { status: 204 });
        return addCorsHeaders(req, res);
      }

      // ✅ WebSocket Upgrade
      if (url.pathname === "/ws") {
        const token = url.searchParams.get("token");
        const clientId = generateClientId();

        const success = server.upgrade(req, {
          data: { clientId },
        });

        if (!success) {
          return new Response("WebSocket upgrade failed", { status: 400 });
        }

        if (token) {
          pendingWsTokens.set(clientId, token);
        }

        return;
      }

      // ✅ Normal HTTP routes (Hono)
      const response = await app.fetch(req, {
        IP: server.requestIP(req),
      });

      return addCorsHeaders(req, response);
    },

    websocket: {
      open(ws) {
        handleWsOpen(ws);

        const token = pendingWsTokens.get(ws.data.clientId);
        if (token) {
          pendingWsTokens.delete(ws.data.clientId);

          const authed = authenticateWs(ws, token);
          if (!authed) {
            sendToClient(ws.data.clientId, {
              type: "error",
              message: "Authentication failed",
            });
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

  const protocol = CONFIG.DEV_MODE ? "http" : "https";
  const wsProtocol = CONFIG.DEV_MODE ? "ws" : "wss";

  console.log(`
╔═══════════════════════════════════════╗
║           Tradex Backend              ║
╠═══════════════════════════════════════╣
║  HTTP: ${protocol}://localhost:${CONFIG.PORT}
║  WS:   ${wsProtocol}://localhost:${CONFIG.PORT}/ws
║  Mode: ${CONFIG.DEV_MODE ? "Development" : "Production"}
╚═══════════════════════════════════════╝
  `);
}

// ✅ Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[server] Shutting down...");
  stopPricePolling();
  stopOptionSettlement();
  stopLeaderboardRebuild();
  closeDb();
  process.exit(0);
});

start();
