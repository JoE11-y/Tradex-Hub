# Tradex Hub

**Learn to trade. Prove it on-chain.**

Tradex is a gamified crypto trading education platform built on Stellar. It teaches newcomers how to trade through three progressive learning modules -- pattern recognition, price prediction, and paper trading -- all powered by real Binance market data. Player achievements are minted as verifiable on-chain badges backed by zero-knowledge proofs (Noir/UltraHonk) on Soroban.

No real money. No risk. Just learning, with cryptographic proof you actually learned something.

## Architecture

Backend-first design. The server (Bun + Hono + SQLite) is the single source of truth for all trading state, gamification, and the ZK proof pipeline. The React frontend is a thin client that calls REST APIs and receives WebSocket pushes.

```text
                           ┌──────────────┐
                           │ Binance API  │
                           └──────┬───────┘
                                  │ (poll every 2s)
                  ┌───────────────▼───────────────────┐
                  │  BACKEND (Bun + Hono + SQLite)    │
                  │                                    │
                  │  Price Service    Trading Engine   │
                  │  Options Engine   Session Manager  │
                  │  Achievement Engine   Leaderboard  │
                  │  Badge Service    Proof Pipeline   │
                  │  Pattern Service  Prediction Svc   │
                  └──────┬──────────────┬──────────────┘
                         │ REST         │ WebSocket
                  ┌──────▼──────────────▼──────────────┐
                  │  FRONTEND (React 19 thin client)   │
                  │  Charts, forms, display only       │
                  └──────┬─────────────────────────────┘
                         │ (wallet tx signing)
                  ┌──────▼─────────────────────────────┐
                  │  Soroban (Stellar Testnet)          │
                  │  TradexHub contract + UltraHonk    │
                  └────────────────────────────────────┘
```

### Tech Stack

| Layer          | Technology                                                    |
| -------------- | ------------------------------------------------------------- |
| Backend        | Bun + Hono + bun:sqlite                                       |
| Frontend       | React 19 + Vite 7 + TailwindCSS 4 + Zustand 5                 |
| Charts         | Lightweight Charts 5.1 (TradingView)                          |
| Routing        | React Router v7 (URL-based page navigation)                   |
| Smart Contract | Soroban (Rust, `wasm32v1-none`)                               |
| ZK Circuits    | Noir 1.0.0-beta.9 + UltraHonk (Barretenberg 0.87.0)           |
| Wallet         | StellarWalletsKit (Freighter, xBull, Lobstr, etc.) + dev mode |
| Market Data    | Binance API (real-time + historical klines)                   |

## Learning Modules

### Pattern Recognition

Players identify 12 chart pattern types (double tops, head & shoulders, bull flags, etc.) from real historical candlestick data. A streak multiplier system (up to 2x XP) rewards consistency.

### Price Predictions

Players predict price direction for BTC, ETH, and XLM using real Binance kline data. A credibility score (0-100) tracks accuracy over time with simulated fast-forward resolution.

### Paper Trading

Full futures and options simulator against live market prices. Long/short positions with 2x/5x/10x leverage (gated by player level), automatic liquidation simulation, and binary-style options with configurable expiry (1m to 1h). Starting balance: $10,000 simulated USDT.

## Progression System

- **30 levels** across 4 tiers (Novice/Trader/Pro/Master)
- **15+ achievements** spanning trading, education, and risk management
- **25 mintable badges** -- on-chain ZK-verified credentials
- **Global leaderboard** rebuilt every 30 seconds
- **Risk management**: 5% drawdown lockout, XP penalties for blown accounts

## ZK Badge System

Badges are verifiable on-chain credentials backed by zero-knowledge proofs. Players prove they meet a badge threshold (e.g. "500+ XP", "10 winning streak") without revealing their full stat profile.

**Trust chain**: Server attests stats (Ed25519) -> Noir circuit proves eligibility -> Soroban contract verifies both -> Badge permanently recorded on-chain.

## URL Routes

| Route                       | Page                  |
| --------------------------- | --------------------- |
| `/`                         | Lobby (module select) |
| `/games/trading/:playerId`  | Paper Trading         |
| `/games/patterns/:playerId` | Pattern Recognition   |
| `/games/forecast/:playerId` | Price Predictions     |
| `/games/profile/:playerId`  | Player Profile        |
| `/games/summary/:playerId`  | Session Summary       |
| `/leaderboard`              | Global Leaderboard    |

## Project Structure

```text
tradex-hub-frontend/               # Standalone frontend (this package)
├── src/
│   ├── App.tsx                    # Root: wraps TradexGame in react-router
│   ├── main.tsx                   # Entry: BrowserRouter + StrictMode
│   ├── index.css                  # Tailwind imports + animations
│   └── games/tradex/
│       ├── TradexGame.tsx         # Root component: WS lifecycle, route definitions
│       ├── routeNav.ts            # Global navigate bridge (Zustand <-> react-router)
│       ├── types.ts               # Levels, achievements, badge definitions
│       ├── pages/
│       │   ├── LoginPage.tsx      # Wallet connection (StellarWalletsKit) + dev mode
│       │   ├── LobbyPage.tsx      # Module selector + quick nav
│       │   ├── TradingPage.tsx    # Main trading interface
│       │   ├── SummaryPage.tsx    # Session results
│       │   ├── ProfilePage.tsx    # Player stats, badges, achievements
│       │   ├── LeaderboardPage.tsx # Global rankings
│       │   ├── PatternPage.tsx    # Pattern recognition challenges
│       │   └── PredictionPage.tsx # Price prediction challenges
│       ├── components/
│       │   ├── TradingChart.tsx   # TradingView Lightweight Charts (candlestick + volume)
│       │   ├── CandleChart.tsx    # Standalone candle chart (pattern/prediction modules)
│       │   ├── OrderPanel.tsx     # Futures order entry (side, leverage, margin)
│       │   ├── OptionsPanel.tsx   # Options order entry (call/put, strike, expiry)
│       │   ├── PositionsList.tsx  # Open positions with live PnL
│       │   ├── ActiveOptions.tsx  # Open option contracts with countdown
│       │   ├── PortfolioWidget.tsx # Balance, margin, unrealized PnL
│       │   ├── TradeHistory.tsx   # Closed trade records
│       │   ├── LeaderboardTable.tsx # Ranked player table
│       │   ├── BadgeCollection.tsx # Badge display + mint flow
│       │   ├── AchievementGrid.tsx # Achievement display
│       │   ├── PlayerCard.tsx     # Player level, XP bar
│       │   ├── NavBar.tsx         # Top navigation with player ID + XP bar
│       │   ├── TickerBar.tsx      # Live price ticker
│       │   ├── AssetHeader.tsx    # Asset info display
│       │   ├── StreakIndicator.tsx # Streak multiplier display
│       │   ├── SessionHistoryList.tsx # Past sessions
│       │   ├── BottomTabs.tsx     # Tab navigation (positions/history/achievements)
│       │   └── NotificationToast.tsx # XP, achievement, liquidation notifications
│       ├── store/
│       │   ├── tradingStore.ts    # Trading state (async REST actions)
│       │   ├── gameStore.ts       # Gamification state (XP, levels, navigation)
│       │   ├── connectionStore.ts # Auth, session restore, WebSocket connection
│       │   └── educationStore.ts  # Pattern + prediction module state
│       └── services/
│           ├── api.ts             # REST client (typed endpoints, token persistence)
│           └── wsClient.ts        # WebSocket manager
│
backend/                           # Bun + Hono backend (source of truth)
│   └── src/
│       ├── index.ts               # Server entry + dev player seeding
│       ├── config.ts              # Constants, env vars
│       ├── db/                    # SQLite schema, connection, repositories
│       ├── services/              # Trading, options, badges, patterns, predictions
│       ├── api/                   # REST routes + handlers
│       └── ws/                    # WebSocket handler + broadcaster
│
contracts/tradex-hub/              # Soroban smart contract (UltraHonk verification)
circuits/badge_proof/              # Noir ZK circuit (badge eligibility proofs)
scripts/                           # Build, deploy, setup automation
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.1+)
- [Rust](https://rustup.rs) + `wasm32v1-none` target
- [Noir](https://noir-lang.org) v1.0.0-beta.9 (`nargo`)
- [Barretenberg](https://github.com/AztecProtocol/barretenberg) v0.87.0 (`bb`)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli) (`stellar`)

### Setup

```bash
# From the Tradex-App root
bun install
cd backend && bun install && cd ..
cd tradex-hub-frontend && bun install && cd ..

# Deploy contracts + generate config (one-time)
bun run setup
```

### Development

```bash
# Start backend (port 3001) -- source of truth for all game state
bun run dev:backend

# Start frontend (port 5173)
bun run dev:game tradex-hub
```

On first backend start with a fresh DB, dev players 1 and 2 are auto-seeded from the `.env` wallet addresses.

### Build ZK Circuit

```bash
bun run build:circuits          # compile + generate VK
bun run build:circuits:prove    # also generate + verify test proof
```

### All Commands

```bash
bun run setup                # Build + deploy contracts, generate bindings, write .env
bun run build [name]         # Build all or selected Soroban contracts
bun run deploy [name]        # Deploy all or selected contracts to testnet
bun run bindings [name]      # Generate TypeScript bindings
bun run dev                  # Run sgs_frontend dev server
bun run dev:game <name>      # Run a standalone game frontend (e.g. tradex-hub)
bun run dev:backend          # Run backend dev server (port 3001, watch mode)
bun run start:backend        # Run backend in production mode
bun run build:circuits       # Compile Noir circuit + generate verification key
bun run build:circuits:prove # Compile + generate + verify a test proof
```

## API Surface

### REST Endpoints (26 total)

| Group       | Endpoints                                                                  |
| ----------- | -------------------------------------------------------------------------- |
| Auth        | `POST /api/auth/challenge`, `/verify`, `/dev-login`                        |
| Player      | `GET /api/player/profile`, `PATCH /api/player/profile`                     |
| Session     | `POST /api/session/start`, `/end`, `/reset`, `GET /current`, `/history`    |
| Trading     | `POST /api/trade/open`, `/close`                                           |
| Options     | `GET /api/options/strikes`, `POST /api/options/open`                       |
| Leaderboard | `GET /api/leaderboard`                                                     |
| Badges      | `GET /api/badges/eligible`, `/mine`, `POST /api/badges/prepare`, `/mint`   |
| Patterns    | `POST /api/patterns/challenge`, `/answer`, `GET /api/patterns/stats`       |
| Predictions | `POST /api/predictions/challenge`, `/answer`, `GET /api/predictions/stats` |
| Prices      | `GET /api/prices/current`, `/candles`                                      |

### WebSocket Events

**Server -> Client**: `price_update`, `candle_update`, `portfolio_update`, `position_liquidated`, `option_settled`, `xp_awarded`, `level_up`, `achievement_unlocked`, `leaderboard_update`, `drawdown_lockout`, `account_blown`, `position_closed_sltp`, `xp_penalty`, `level_down`

**Client -> Server**: `subscribe_prices`, `unsubscribe_prices`, `subscribe_candles`, `ping`

## Session Persistence

Auth tokens are stored in `sessionStorage` and automatically restored on page refresh. The backend (SQLite) is the source of truth for all player data -- XP, levels, achievements, badges, trade history. On refresh, the frontend validates the stored token, fetches the full player profile from the DB, and reconnects the WebSocket.

## License

MIT
