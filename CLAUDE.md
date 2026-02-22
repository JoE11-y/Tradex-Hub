# Tradex - Gamified Crypto Trading Education Platform

Tradex is a gamified crypto trading education platform built on Stellar. It teaches newcomers to trade crypto through three progressive learning modules, unified by an XP/level/achievement system with ZK-verifiable credentials on Soroban.

## Product Overview

### Three Learning Modules

1. **Pattern Recognition** - Players identify chart patterns (12 types: uptrend, double top, head & shoulders, etc.) from real historical candlestick data. Scoring uses streak multipliers (1x/1.25x/1.5x/2x) for consecutive correct answers.

2. **Predictions** - Players predict price direction for real Stellar ecosystem tokens using historical Binance kline data. A credibility scoring system (0-100) tracks accuracy over time with simulated fast-forward resolution.

3. **Paper Trading** - Full futures and options trading simulator against real market data (Binance). Includes leverage (2x/5x/10x), liquidation simulation, and options (call/put with configurable expiry).

### Unified Progression System

- **XP & Levels** (1-30): 4 tiers (Novice/Trader/Pro/Master), exponential XP curve, gates leverage (2x/5x/10x)
- **Achievements** (18 total): 10 trading + 5 education + 3 risk management achievements
- **Badges** (25 types, 0-24): ZK-provable on-chain credentials via Noir/UltraHonk on Soroban
- **Economy**: Education modules are low-risk XP/balance sources (entry fees + bonuses), trading is high-risk balance sink
- **Risk Management**: 5% daily drawdown lockout, 10% XP penalty on account reset, 5-min cooldown

### ZK Credential Layer

- **Badge proofs only**: Player-facing, proves stat thresholds without revealing full stats
- **Noir circuit**: `badge_proof` (credential eligibility, 12 stats polynomial accumulator, 25 badge types)
- **On-chain verification**: UltraHonk proofs verified by Soroban contract (`tradex-hub`)
- **No trade batch proofs**: Trade session proofs were removed; only badge credentials remain on-chain

## Architecture

Backend-first: Bun + Hono + bun:sqlite is source of truth. Frontend is a thin React client that calls REST API and receives WebSocket pushes.

### Data Sources

- **Binance API**: Real-time prices (2s polling), historical klines for all modules
- **Pre-labeled pattern library**: Curated candlestick segments with annotated patterns for Pattern Recognition module

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Bun + Hono + bun:sqlite |
| Frontend | React 19 + Vite 7 + TailwindCSS 4 + Zustand 5 |
| Charts | Lightweight Charts 5.1 (TradingView) |
| Contracts | Soroban (Rust, wasm32v1-none) |
| ZK | Noir 1.0.0-beta.9 + UltraHonk (Barretenberg 0.87.0) |
| Wallet | Stellar Freighter + dev wallet mode |

## Key File Paths

### Backend (`backend/src/`)
- `services/tradingEngine.ts` - Futures trading engine
- `services/optionsEngine.ts` - Options trading engine
- `services/patternService.ts` - Pattern recognition challenges
- `services/predictionService.ts` - Price prediction challenges
- `services/badgeService.ts` - Badge eligibility, attestation hash (12 stats), proof generation
- `services/achievementEngine.ts` - Achievement detection + XP awards
- `api/handlers/patterns.ts` - Pattern challenge API endpoints
- `api/handlers/predictions.ts` - Prediction challenge API endpoints
- `domain/types.ts` - All types, badge defs (BADGE_DEFS), achievement defs, level tables
- `db/schema.ts` - SQLite migrations (players, sessions, positions, pattern_challenges, prediction_challenges)

### Frontend (`sgs_frontend/src/games/tradex/`)
- `pages/PatternPage.tsx` - Pattern recognition UI
- `pages/PredictionPage.tsx` - Price prediction UI
- `TradexGame.tsx` - Main trading game + session flow
- `store/tradingStore.ts` - Trading state (async actions -> REST API)
- `store/gameStore.ts` - Gamification state (server-synced)
- `store/connectionStore.ts` - Auth + WebSocket connection
- `components/BadgeCollection.tsx` - Badge display + mint flow
- `components/AchievementGrid.tsx` - Achievement display

### Contracts (`contracts/tradex-hub/`)
- `src/lib.rs` - Contract: player registration, badge minting (types 0-24)
- `src/verification.rs` - UltraHonk proof verification for badge proofs

### Circuits (`circuits/`)
- `badge_proof/src/main.nr` - Badge eligibility verifier (25 types, 12 stats polynomial accumulator)

## Conventions

- Snake_case for DB/API fields
- Auth via Bearer token
- Dev login at `POST /api/auth/dev-login`
- Zustand stores for state management
- TypeScript strict mode, no `any`
- All DB operations synchronous (bun:sqlite)
- Education stats on player row: `pattern_correct`, `pattern_total`, `pattern_streak`, `pattern_best_streak`, `prediction_correct`, `prediction_total`, `prediction_streak`, `credibility_score`
