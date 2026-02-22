# Tradex

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
- **25 mintable badges** -- on-chain ZK-verified credentials (see [badge_proof circuit](circuits/badge_proof/))
- **Global leaderboard** rebuilt every 30 seconds
- **Risk management**: 5% drawdown lockout, XP penalties for blown accounts

## ZK Badge System

Badges are verifiable on-chain credentials backed by zero-knowledge proofs. Players prove they meet a badge threshold (e.g. "500+ XP", "10 winning streak") without revealing their full stat profile.

**Trust chain**: Server attests stats (Ed25519) -> [Noir circuit](circuits/badge_proof/) proves eligibility -> [Soroban contract](contracts/tradex-hub/) verifies both -> Badge permanently recorded on-chain.

See the component READMEs for details:

- **[contracts/tradex-hub/](contracts/tradex-hub/)** -- Soroban smart contract with UltraHonk verification
- **[circuits/badge_proof/](circuits/badge_proof/)** -- Noir ZK circuit for badge eligibility proofs

## Project Structure

```text
Tradex-App/
├── backend/                        # Bun + Hono backend (source of truth)
│   └── src/
│       ├── index.ts               # Server entry (Bun.serve + Hono + WebSocket)
│       ├── config.ts              # Constants, env vars
│       ├── db/
│       │   ├── connection.ts      # bun:sqlite singleton
│       │   ├── schema.ts          # CREATE TABLE migrations (10+ tables)
│       │   └── repositories/      # CRUD per table (player, session, position, trade, option)
│       ├── domain/
│       │   ├── types.ts           # Shared types, level tables, badge/achievement definitions
│       │   └── errors.ts          # Error codes
│       ├── services/
│       │   ├── priceService.ts    # Binance proxy + 2s polling + cache
│       │   ├── tradingEngine.ts   # Futures: open/close/liquidate positions
│       │   ├── optionsEngine.ts   # Options: open/settle/expire (call/put)
│       │   ├── sessionManager.ts  # Session lifecycle management
│       │   ├── playerService.ts   # Auth (challenge/verify), profile, XP/levels
│       │   ├── achievementEngine.ts # Achievement detection (15 conditions)
│       │   ├── leaderboardService.ts # Materialized rankings (30s rebuild)
│       │   ├── badgeService.ts    # Badge eligibility check + ZK proof generation
│       │   ├── noirProver.ts      # nargo/bb CLI wrapper for proof generation
│       │   ├── sorobanClient.ts   # Stellar SDK client for contract interaction
│       │   ├── patternService.ts  # Pattern recognition challenges
│       │   └── predictionService.ts # Price prediction challenges
│       ├── api/
│       │   ├── routes.ts          # All REST route definitions
│       │   ├── validate.ts        # Zod schemas for request validation
│       │   ├── middleware/auth.ts # Bearer token auth middleware
│       │   └── handlers/          # Route handlers (9 modules)
│       └── ws/
│           ├── handler.ts         # WebSocket connection management
│           ├── broadcaster.ts     # Broadcast to subscribed clients
│           └── messages.ts        # Typed message definitions (12+ event types)
│
├── sgs_frontend/src/games/tradex/ # React thin client
│   ├── TradexGame.tsx             # Root component: WS lifecycle, page routing
│   ├── pages/
│   │   ├── LoginPage.tsx          # Wallet connection (StellarWalletsKit) + dev mode
│   │   ├── LobbyPage.tsx         # Session start, asset selection
│   │   ├── TradingPage.tsx       # Main trading interface
│   │   ├── SummaryPage.tsx       # Session results
│   │   ├── ProfilePage.tsx       # Player stats, badges, achievements
│   │   ├── LeaderboardPage.tsx   # Global rankings
│   │   ├── PatternPage.tsx       # Pattern recognition challenges
│   │   └── PredictionPage.tsx    # Price prediction challenges
│   ├── components/
│   │   ├── TradingChart.tsx      # TradingView Lightweight Charts (candlestick + volume)
│   │   ├── CandleChart.tsx       # Standalone candle chart (pattern/prediction modules)
│   │   ├── OrderPanel.tsx        # Futures order entry (side, leverage, margin)
│   │   ├── OptionsPanel.tsx      # Options order entry (call/put, strike, expiry)
│   │   ├── PositionsList.tsx     # Open positions with live PnL
│   │   ├── ActiveOptions.tsx     # Open option contracts with countdown
│   │   ├── PortfolioWidget.tsx   # Balance, margin, unrealized PnL
│   │   ├── TradeHistory.tsx      # Closed trade records
│   │   ├── LeaderboardTable.tsx  # Ranked player table
│   │   ├── BadgeCollection.tsx   # Badge display + mint flow
│   │   ├── AchievementGrid.tsx   # Achievement display
│   │   ├── PlayerCard.tsx        # Player level, XP bar
│   │   ├── NavBar.tsx            # Top navigation
│   │   ├── TickerBar.tsx         # Live price ticker
│   │   ├── AssetHeader.tsx       # Asset info display
│   │   ├── StreakIndicator.tsx   # Streak multiplier display
│   │   ├── SessionHistoryList.tsx # Past sessions
│   │   ├── BottomTabs.tsx       # Mobile navigation tabs
│   │   └── NotificationToast.tsx # XP, achievement, liquidation notifications
│   ├── store/
│   │   ├── tradingStore.ts      # Trading state (async REST actions)
│   │   ├── gameStore.ts         # Gamification state (server-synced)
│   │   └── connectionStore.ts   # Auth + WebSocket connection
│   └── services/
│       ├── api.ts               # REST client (typed endpoints)
│       └── wsClient.ts          # WebSocket manager
│
├── contracts/tradex-hub/         # Soroban smart contract (standalone)
│   ├── Cargo.toml               # Pinned soroban-sdk rev for UltraHonk compat
│   └── src/
│       ├── lib.rs               # Contract entry + #[contractimpl]
│       ├── types.rs             # PlayerStats, BadgeRecord
│       ├── storage.rs           # DataKey enum, TTL helpers, CRUD
│       ├── errors.rs            # 9 error variants
│       ├── events.rs            # Event emission helpers
│       └── verification.rs      # UltraHonk proof verification + byte parsing
│
├── circuits/badge_proof/         # Noir ZK circuit
│   ├── Nargo.toml
│   ├── Prover.toml              # Test witness
│   └── src/main.nr              # Badge eligibility verifier (25 types, 12 stats)
│
└── scripts/
    ├── build-badge-circuit.sh   # Compile circuit + generate VK + optional test proof
    └── deploy-tradex-hub.sh     # Build + deploy contract to Stellar testnet
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.1+)
- [Rust](https://rustup.rs) + `wasm32v1-none` target
- [Noir](https://noir-lang.org) v1.0.0-beta.9 (`nargo`)
- [Barretenberg](https://github.com/AztecProtocol/barretenberg) v0.87.0 (`bb`)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli) (`stellar`)

### Development

```bash
# Install dependencies
cd Tradex-App
bun install
cd backend && bun install

# Start backend (port 3001)
cd backend && bun run dev

# Start frontend (port 5173)
cd sgs_frontend && bun run dev
```

### Build ZK Circuit

```bash
./scripts/build-badge-circuit.sh          # compile + generate VK
./scripts/build-badge-circuit.sh --prove  # also generate + verify test proof
```

### Deploy Contract

```bash
ADMIN_SECRET=S... ./scripts/deploy-tradex-hub.sh
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

### WebSocket Protocol

**Server -> Client**: `price_update`, `candle_update`, `portfolio_update`, `position_liquidated`, `option_settled`, `xp_awarded`, `level_up`, `achievement_unlocked`, `leaderboard_update`, `drawdown_lockout`, `account_blown`, `position_closed_sltp`, `xp_penalty`, `level_down`

**Client -> Server**: `subscribe_prices`, `unsubscribe_prices`, `subscribe_candles`, `ping`

## License

MIT
