# badge_proof -- Noir ZK Circuit

Zero-knowledge circuit that proves a player meets the criteria for a specific badge without revealing their full stats. Used by the [tradex-hub Soroban contract](../../contracts/tradex-hub/) to verify badge eligibility before minting on-chain credentials.

## What This Proves

A player can prove statements like "I have 500+ XP" or "I identified 25 patterns in a row" without revealing any other stats. The verifier (Soroban contract) only sees four public values and a proof -- never the player's actual stat breakdown.

## Circuit Design

### Public Inputs (4 Fields = 128 bytes on-chain)

| Field              | Size     | Description                                           |
| ------------------ | -------- | ----------------------------------------------------- |
| `player_id`        | 32 bytes | Binds the proof to a specific player                  |
| `badge_type`       | 32 bytes | Numeric type (0-24), determines which stat is checked |
| `badge_threshold`  | 32 bytes | Required minimum value for the badge                  |
| `attestation_hash` | 32 bytes | Polynomial hash of all 12 server-attested stats       |

### Private Inputs (12 stats from server attestation)

| Stat                  | Description                           |
| --------------------- | ------------------------------------- |
| `total_xp`            | Player's cumulative XP                |
| `total_trades`        | Lifetime trade count                  |
| `win_streak`          | Current consecutive wins              |
| `longest_hold_ms`     | Longest position hold in milliseconds |
| `near_liq_closes`     | Near-liquidation close count          |
| `total_sessions`      | Session count                         |
| `profitable_sessions` | Sessions with positive PnL            |
| `verified_sessions`   | ZK-verified session count             |
| `pattern_correct`     | Correct pattern identifications       |
| `pattern_streak`      | Best pattern identification streak    |
| `prediction_correct`  | Correct price predictions             |
| `credibility_score`   | Prediction credibility score (0-100)  |

### Constraints

**1. Attestation hash verification**

A polynomial accumulator over all 12 stats must match the public `attestation_hash`. This ensures the private stats are authentic (signed by the server).

```text
running = 0
running = running * 997 + total_xp
running = running * 997 + total_trades
...
running = running * 997 + credibility_score
assert(running == attestation_hash)
```

The same polynomial is computed server-side in TypeScript using the same constant (997) and stat ordering. The server signs this hash with Ed25519, and the contract verifies the signature.

**2. Badge type selector**

A conditional accumulator routes each badge type to the correct stat comparison. Exactly one type must match (enforced by `assert(matched == 1)`).

| Types                        | Stat checked                                                  |
| ---------------------------- | ------------------------------------------------------------- |
| 0-9 (level badges)           | `total_xp`                                                    |
| 10, 14, 17, 18 (trade count) | `total_trades`                                                |
| 11, 19 (win streaks)         | `win_streak`                                                  |
| 12 (diamond hands)           | `longest_hold_ms`                                             |
| 13 (liquidation survivor)    | `near_liq_closes`                                             |
| 15 (profitable session)      | `profitable_sessions`                                         |
| 16 (zk verified)             | `verified_sessions`                                           |
| 20 (pattern novice)          | `pattern_correct`                                             |
| 21 (pattern master)          | `pattern_streak`                                              |
| 22 (prediction novice)       | `prediction_correct`                                          |
| 23 (prediction master)       | `credibility_score`                                           |
| 24 (all rounder)             | `total_trades` AND `pattern_correct` AND `prediction_correct` |

**3. Threshold comparison (stat >= badge_threshold)**

Uses 32-bit decomposition: proving `(stat_value - badge_threshold)` fits in 32 bits guarantees it's non-negative in the finite field, which means `stat_value >= badge_threshold`.

**4. All-rounder multi-stat check (type 24 only)**

When `badge_type == 24`, the circuit additionally enforces that `pattern_correct >= threshold` AND `prediction_correct >= threshold`, requiring activity across all three learning modules.

## Why Polynomial Accumulator (Not Poseidon)

Using `running = running * 997 + value` avoids hash-matching issues between TypeScript and Noir. The accumulator is trivially computed in both languages with identical results. Since the on-chain verifier doesn't recompute the hash (it only checks the proof is valid for the given public inputs), this is sufficient.

## Build

### Prerequisites

- [Noir](https://noir-lang.org) v1.0.0-beta.9 (`nargo`)
- [Barretenberg](https://github.com/AztecProtocol/barretenberg) v0.87.0 (`bb`)

### Compile + Generate VK

```bash
./scripts/build-badge-circuit.sh
```

This runs:

1. `nargo compile` -- compiles the circuit to `target/badge_proof.json`
2. `bb write_vk` -- generates the verification key at `target/vk`

### Compile + Generate VK + Test Proof

```bash
./scripts/build-badge-circuit.sh --prove
```

Additionally runs:
3. `nargo execute` -- generates a witness from `Prover.toml`
4. `bb prove` -- generates a proof at `target/proof` (14,592 bytes)
5. `bb verify` -- verifies the proof locally

### Run Tests

```bash
nargo test --program-dir circuits/badge_proof
```

6 tests covering:

- `test_level_1_badge` -- Zero-threshold baseline (type 0)
- `test_level_2_badge` -- XP threshold check (type 1, threshold 100)
- `test_first_blood_badge` -- Trade count check (type 10, threshold 1)
- `test_diamond_hands_badge` -- Hold duration check (type 12, threshold 600,000ms)
- `test_pattern_novice_badge` -- Education stat check (type 20, threshold 10)
- `test_all_rounder_badge` -- Multi-stat check (type 24, threshold 10 across 3 modules)

## Build Artifacts

| Artifact         | Size                 | Path                      |
| ---------------- | -------------------- | ------------------------- |
| Compiled circuit | ~varies              | `target/badge_proof.json` |
| Verification key | ~1,760 bytes         | `target/vk`               |
| Proof            | 14,592 bytes (fixed) | `target/proof`            |
| Public inputs    | 128 bytes (4 Fields) | `target/public_inputs`    |

The verification key (`target/vk`) is deployed to the [tradex-hub contract](../../contracts/tradex-hub/) via `set_badge_vk`. The proof size is fixed at 14,592 bytes regardless of circuit complexity (UltraHonk property).

## End-to-End Flow

```
Player clicks "Mint Badge"
  → Backend checks eligibility (stat >= threshold)
  → Backend collects 12 player stats
  → Backend computes attestation_hash (polynomial accumulator)
  → Backend writes Prover.toml with public + private inputs
  → nargo execute → witness
  → bb prove → 14,592-byte proof + 128-byte public inputs
  → Frontend receives proof_hex + public_inputs_hex
  → Admin submits mint_badge tx to Soroban contract
  → Contract verifies proof against stored VK (UltraHonk)
  → Contract parses badge_type from public inputs
  → Contract stores BadgeRecord (persistent, ~30-day TTL with auto-bump)
  → Badge event emitted on-chain
```
