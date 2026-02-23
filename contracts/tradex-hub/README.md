# Tradex-hub -- Soroban Smart Contract

Soroban smart contract for the Tradex platform. Handles player registration, ZK-verified badge minting as **NFTs** (using OpenZeppelin Stellar Contracts), and on-chain credential storage with UltraHonk proof verification.

## Overview

`tradex-hub` is a Soroban contract that integrates:
- [UltraHonk Rust verifier](https://github.com/yugocabrio/ultrahonk-rust-verifier) for ZK proof verification
- [OpenZeppelin Stellar Contracts](https://github.com/OpenZeppelin/stellar-contracts) (`stellar-tokens` v0.6.0) for NFT functionality

Badges are real on-chain NFTs with standard ownership, transfer, approval, and burn semantics. Each badge is minted via `Base::sequential_mint()` after ZK proof verification, giving players transferable credentials.

## Contract Functions

### Custom Functions

| Function | Access | Description |
|----------|--------|-------------|
| `__constructor(admin, attestor_pubkey)` | Deploy | Initialize admin, attestor key, and NFT metadata |
| `register_player(player)` | Player auth | Create PlayerStats record (idempotent) |
| `mint_badge(admin, player, name, badge_type, public_inputs, proof_bytes)` | Admin only | Verify badge ZK proof and mint NFT to player. Returns `u32` token_id |
| `has_badge(player, badge_type)` | Public | Check if a player has a specific badge type |
| `get_player(player)` | Public | Read player stats |
| `get_badge_count(player)` | Public | Count player's minted badge NFTs (delegates to OZ `balance`) |
| `get_badge_meta(token_id)` | Public | Read badge metadata by NFT token_id |
| `set_attestor(pubkey)` | Admin only | Rotate the Ed25519 attestor public key |
| `set_badge_vk(vk_bytes)` | Admin only | Set or rotate the badge proof verification key |

### Standard NFT Functions (via OpenZeppelin `NonFungibleToken` trait)

| Function | Description |
|----------|-------------|
| `balance(account)` | Number of NFTs owned by account |
| `owner_of(token_id)` | Address that owns a specific NFT |
| `transfer(from, to, token_id)` | Transfer NFT (requires owner auth) |
| `transfer_from(spender, from, to, token_id)` | Transfer using approval |
| `approve(approver, approved, token_id, live_until_ledger)` | Approve another address for a token |
| `approve_for_all(owner, operator, live_until_ledger)` | Approve operator for all tokens |
| `get_approved(token_id)` | Get approved address for a token |
| `is_approved_for_all(owner, operator)` | Check operator approval |
| `name()` | Collection name: "Tradex Badges" |
| `symbol()` | Collection symbol: "TXBDG" |
| `token_uri(token_id)` | Token URI: `https://tradex.app/badges/{token_id}` |

### Burn Functions (via OpenZeppelin `NonFungibleBurnable` trait)

| Function | Description |
|----------|-------------|
| `burn(from, token_id)` | Burn an NFT (requires owner auth) |
| `burn_from(spender, from, token_id)` | Burn using approval |

## Data Types

### PlayerStats

```rust
pub struct PlayerStats {
    pub total_sessions: u32,
    pub verified_sessions: u32,
    pub total_pnl_cents: i128,
    pub registered_at: u64,
}
```

### BadgeRecord

```rust
pub struct BadgeRecord {
    pub name: String,          // e.g. "Apprentice", "Winning Streak"
    pub badge_type: u32,       // 0-24 (matches Noir circuit types)
    pub earned_at: u64,        // ledger timestamp
}
```

Badge metadata is stored separately from the NFT and keyed by `token_id`. The NFT itself tracks ownership, while `BadgeRecord` stores the game-specific metadata.

## Storage Layout

| Storage Type | Key | Data | TTL |
|---|---|---|---|
| Instance | `Admin` | Admin address | ~30 days (auto-bumped) |
| Instance | `BadgeVk` | Badge verification key bytes | ~30 days |
| Instance | `Attestor` | Ed25519 public key (32 bytes) | ~30 days |
| Persistent | `Player(Address)` | PlayerStats | ~30 days (bumped on read) |
| Persistent | `BadgeMeta(u32)` | BadgeRecord (keyed by NFT token_id) | ~30 days (bumped on read) |
| Persistent | `BadgeByType(Address, u32)` | u32 token_id (duplicate prevention index) | ~30 days |

OpenZeppelin manages additional NFT storage internally:

| Key | Data |
|---|---|
| `NFTStorageKey::Owner(u32)` | Token owner address |
| `NFTStorageKey::Balance(Address)` | Token count per account |
| `NFTStorageKey::Approval(u32)` | Per-token approval |
| `NFTStorageKey::ApprovalForAll(Address, Address)` | Operator approvals |
| `NFTStorageKey::Metadata` | Collection name, symbol, base URI |

## Badge Types (25 total)

| Type | Badge ID | Condition | Stat Checked |
|------|----------|-----------|--------------|
| 0-9 | `level_1` through `level_10` | XP thresholds (0 to 10,000) | `total_xp` |
| 10 | `first_blood` | Complete 1 trade | `total_trades` |
| 11 | `winning_streak` | 5 consecutive wins | `win_streak` |
| 12 | `diamond_hands` | Hold 10+ minutes | `longest_hold_ms` |
| 13 | `liquidation_survivor` | 3 near-liquidation closes | `near_liq_closes` |
| 14 | `ten_trades` | Complete 10 trades | `total_trades` |
| 15 | `profitable_session` | 1 profitable session | `profitable_sessions` |
| 16 | `zk_verified` | 1 verified session | `verified_sessions` |
| 17 | `fifty_trades` | Complete 50 trades | `total_trades` |
| 18 | `century_trader` | Complete 100 trades | `total_trades` |
| 19 | `iron_streak` | 10 consecutive wins | `win_streak` |
| 20 | `pattern_novice` | 10 correct patterns | `pattern_correct` |
| 21 | `pattern_master` | 25 pattern streak | `pattern_streak` |
| 22 | `prediction_novice` | 10 correct predictions | `prediction_correct` |
| 23 | `prediction_master` | 80+ credibility score | `credibility_score` |
| 24 | `all_rounder` | 10+ in all three modules | `total_trades`, `pattern_correct`, `prediction_correct` |

## Verification Flow

1. Backend generates a badge ZK proof using the [badge_proof circuit](../../circuits/badge_proof/) (Noir + Barretenberg)
2. Proof is 14,592 bytes (fixed size, UltraHonk). Public inputs are 128 bytes (4 x 32-byte Fields)
3. `mint_badge` receives the proof and public inputs
4. Contract parses `badge_type` from public inputs (bytes 32-63, last 4 bytes as big-endian u32)
5. `verification::verify_with_vk` creates an `UltraHonkVerifier` from the stored VK and verifies the proof
6. On success, an NFT is minted to the player via `Base::sequential_mint()`, badge metadata is stored, and OZ emits a standard `Mint` event

## Events

| Event | Source | Topics | Data |
|-------|--------|--------|------|
| Mint | OZ (automatic) | `["mint", player_address]` | `token_id: u32` |
| Transfer | OZ (automatic) | `["transfer", from, to]` | `token_id: u32` |
| Burn | OZ (automatic) | `["burn", from]` | `token_id: u32` |
| Attestor rotated | Custom | `("admin",)` | `("attestor", pubkey)` |
| Badge VK updated | Custom | `("admin",)` | `("bvk_set",)` |

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 1 | `NotAdmin` | Caller is not the admin |
| 2 | `PlayerNotRegistered` | Player not found |
| 5 | `ProofVerificationFailed` | ZK proof did not verify |
| 6 | `InvalidPublicInputs` | Public inputs wrong size or format |
| 8 | `AttestorNotSet` | No attestor key configured |
| 9 | `VkParseError` | Could not parse verification key |
| 10 | `ProofParseError` | Proof wrong size (expected 14,592 bytes) |
| 11 | `BadgeVkNotSet` | No badge VK set (call `set_badge_vk` first) |
| 12 | `InvalidBadgeType` | Badge type > 24 |

OZ also defines NFT errors (codes 200+): `NonExistentToken`, `IncorrectOwner`, `InsufficientApproval`, etc.

## Build

```bash
cd Tradex-App

# Build WASM
cargo build --release --target wasm32v1-none -p tradex-hub

# Output: target/wasm32v1-none/release/tradex_hub.wasm
```

## Deploy

```bash
# Full deploy script (builds, installs WASM, deploys with constructor, sets badge VK)
ADMIN_SECRET=S... ./scripts/deploy-tradex-hub.sh

# Or manually:
stellar contract install --wasm target/wasm32v1-none/release/tradex_hub.wasm \
  --source-account $ADMIN_SECRET --network testnet

stellar contract deploy --wasm-hash $WASM_HASH \
  --source-account $ADMIN_SECRET --network testnet \
  -- --admin $ADMIN_ADDRESS --attestor_pubkey $ATTESTOR_PUBKEY_HEX

stellar contract invoke --id $CONTRACT_ID \
  --source-account $ADMIN_SECRET --network testnet \
  -- set_badge_vk --vk_bytes $BADGE_VK_HEX
```

## Dependencies

| Crate | Source | Purpose |
|-------|--------|---------|
| `soroban-sdk` | Git (pinned rev) | Soroban host functions, storage, auth |
| `ultrahonk_soroban_verifier` | Git (pinned rev) | UltraHonk proof verification on BN254 |
| `stellar-tokens` | Git (OZ Stellar Contracts v0.6.0) | NFT Base, NonFungibleToken, NonFungibleBurnable |
| `stellar-access` | Git (OZ Stellar Contracts v0.6.0) | Access control utilities |
