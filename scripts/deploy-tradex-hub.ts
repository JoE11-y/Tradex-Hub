#!/usr/bin/env bun

/**
 * Deploy tradex-hub contract to Stellar testnet.
 *
 * Steps:
 *   1. Generate or reuse Ed25519 attestor keypair
 *   2. Read VK files from compiled circuits
 *   3. Build and optimize tradex-hub WASM
 *   4. Fund admin account via Friendbot
 *   5. Deploy with constructor: (admin, vk_bytes, attestor_pubkey)
 *   6. Set badge VK via set_badge_vk() invocation
 *   7. Save to .env: TRADEX_HUB_CONTRACT_ID, SERVER_SECRET_KEY, ATTESTOR_SECRET_KEY
 *
 * Usage:
 *   bun run scripts/deploy-tradex-hub.ts
 *   bun run scripts/deploy-tradex-hub.ts --skip-build  # Skip contract build step
 */

import { $ } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readEnvFile, getEnvValue } from "./utils/env";

const PROJECT_DIR = join(import.meta.dir, "..");
const CONTRACT_DIR = join(PROJECT_DIR, "contracts", "tradex-hub");
const BADGE_CIRCUIT_DIR = join(PROJECT_DIR, "circuits", "badge_proof");
const ENV_PATH = join(PROJECT_DIR, "backend", ".env");

const NETWORK = "testnet";
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

const skipBuild = process.argv.includes("--skip-build");

// ── Helpers ──

type StellarKeypair = { publicKey(): string; secret(): string };
type StellarKeypairFactory = {
  random(): StellarKeypair;
  fromSecret(s: string): StellarKeypair;
};

async function loadKeypairFactory(): Promise<StellarKeypairFactory> {
  try {
    const sdk = await import("@stellar/stellar-sdk");
    return sdk.Keypair;
  } catch {
    console.log("Installing @stellar/stellar-sdk...");
    await $`bun install @stellar/stellar-sdk`;
    const sdk = await import("@stellar/stellar-sdk");
    return sdk.Keypair;
  }
}

async function ensureFunded(address: string): Promise<void> {
  const res = await fetch(
    `https://horizon-testnet.stellar.org/accounts/${address}`,
  );
  if (res.ok) return;

  console.log(`  Funding ${address} via Friendbot...`);
  const fundRes = await fetch(`https://friendbot.stellar.org?addr=${address}`);
  if (!fundRes.ok) throw new Error(`Friendbot failed (${fundRes.status})`);

  // Wait for account to appear
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const check = await fetch(
      `https://horizon-testnet.stellar.org/accounts/${address}`,
    );
    if (check.ok) return;
  }
  throw new Error(`Account ${address} not found after funding`);
}

function fileToHex(path: string): string {
  const bytes = new Uint8Array(
    Bun.file(path).arrayBuffer() as unknown as ArrayBuffer,
  );
  // Bun.file().arrayBuffer() returns a promise, use sync read instead
  const buf = require("fs").readFileSync(path);
  return Buffer.from(buf).toString("hex");
}

// ── Main ──

console.log("\n=== Tradex-Hub Deployment ===\n");

const Keypair = await loadKeypairFactory();

// Step 1: Load or generate keys
const existingEnv = await readEnvFile(ENV_PATH);

let adminSecret = getEnvValue(existingEnv, "SERVER_SECRET_KEY");
let attestorSecret = getEnvValue(existingEnv, "ATTESTOR_SECRET_KEY");

const adminKeypair = adminSecret
  ? Keypair.fromSecret(adminSecret)
  : Keypair.random();
adminSecret = adminKeypair.secret();
const adminAddress = adminKeypair.publicKey();

console.log(`Admin:    ${adminAddress}`);
console.log(`  ${adminSecret ? "(reusing from .env)" : "(newly generated)"}`);

// For attestor, we need a raw Ed25519 keypair (not Stellar)
// Generate 32 random bytes as the secret, derive pubkey
if (!attestorSecret) {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  attestorSecret = Buffer.from(buf).toString("hex");
  console.log(`Attestor: (newly generated)`);
} else {
  console.log(`Attestor: (reusing from .env)`);
}

// Derive Ed25519 public key from secret
let attestorPubkeyHex: string;
try {
  const result = await $`python3 -c "
from nacl.signing import SigningKey
import sys
sk = SigningKey(bytes.fromhex('${attestorSecret}'))
print(sk.verify_key.encode().hex())
"`.text();
  attestorPubkeyHex = result.trim();
} catch {
  // Fallback: use openssl
  try {
    const result = await $`echo -n "${attestorSecret}" | python3 -c "
import sys, subprocess
secret = bytes.fromhex(sys.stdin.read().strip())
der_prefix = b'\\x30\\x2e\\x02\\x01\\x00\\x30\\x05\\x06\\x03\\x2b\\x65\\x70\\x04\\x22\\x04\\x20'
result = subprocess.run(
    ['openssl', 'pkey', '-inform', 'DER', '-outform', 'DER', '-pubout'],
    input=der_prefix + secret, capture_output=True
)
print(result.stdout[-32:].hex())
"`.text();
    attestorPubkeyHex = result.trim();
  } catch {
    console.error(
      "ERROR: Could not derive Ed25519 public key. Install python3-nacl: pip install pynacl",
    );
    process.exit(1);
  }
}
console.log(`Attestor pubkey: ${attestorPubkeyHex}`);

// Step 2: Check badge VK file
const badgeVkPath = join(BADGE_CIRCUIT_DIR, "target", "vk");

if (!existsSync(badgeVkPath)) {
  console.error(`ERROR: Badge VK not found at ${badgeVkPath}`);
  console.error("  Run: ./scripts/build-badge-circuit.sh");
  process.exit(1);
}

const badgeVkHex = fileToHex(badgeVkPath);
console.log(`Badge VK: ${badgeVkHex.length / 2} bytes`);

// Step 3: Build contract
let wasmPath = join(
  CONTRACT_DIR,
  "target",
  "wasm32v1-none",
  "release",
  "tradex_hub.wasm",
);

if (!skipBuild) {
  console.log("\n==> Building tradex-hub contract...");
  await $`cd ${CONTRACT_DIR} && cargo build --release --target wasm32v1-none`;

  if (!existsSync(wasmPath)) {
    console.error(`ERROR: WASM not found at ${wasmPath}`);
    process.exit(1);
  }

  console.log("==> Optimizing WASM...");
  try {
    await $`stellar contract optimize --wasm ${wasmPath}`;
    const optimizedPath = wasmPath.replace(".wasm", ".optimized.wasm");
    if (existsSync(optimizedPath)) wasmPath = optimizedPath;
  } catch {
    console.log(
      "  (optimization skipped - stellar contract optimize not available)",
    );
  }
}

if (!existsSync(wasmPath)) {
  console.error(
    `ERROR: WASM not found at ${wasmPath}. Run without --skip-build.`,
  );
  process.exit(1);
}

const wasmSize = require("fs").statSync(wasmPath).size;
console.log(`WASM: ${wasmSize} bytes`);

// Step 4: Fund admin
console.log("\n==> Ensuring admin account is funded...");
await ensureFunded(adminAddress);
console.log("  Admin funded");

// Step 5: Deploy
console.log("\n==> Installing WASM...");
const wasmHash = (
  await $`stellar contract install --wasm ${wasmPath} --source-account ${adminSecret} --network ${NETWORK}`.text()
).trim();
console.log(`  WASM hash: ${wasmHash}`);

console.log("==> Deploying with constructor...");
const contractId = (
  await $`stellar contract deploy --wasm-hash ${wasmHash} --source-account ${adminSecret} --network ${NETWORK} -- --admin ${adminAddress} --attestor_pubkey ${attestorPubkeyHex}`.text()
).trim();
console.log(`  Contract ID: ${contractId}`);

// Step 6: Set badge VK
console.log("==> Setting badge VK...");
await $`stellar contract invoke --id ${contractId} --source-account ${adminSecret} --network ${NETWORK} -- set_badge_vk --vk_bytes ${badgeVkHex}`;
console.log("  Badge VK set");

// Step 7: Save to .env
console.log("\n==> Saving to backend/.env...");

const newEnvVars: Record<string, string> = {
  ...existingEnv,
  TRADEX_HUB_CONTRACT_ID: contractId,
  SERVER_SECRET_KEY: adminSecret,
  ATTESTOR_SECRET_KEY: attestorSecret,
  STELLAR_RPC_URL: RPC_URL,
  STELLAR_NETWORK_PASSPHRASE: NETWORK_PASSPHRASE,
};

const envContent = Object.entries(newEnvVars)
  .map(([k, v]) => `${k}=${v}`)
  .join("\n");

await Bun.write(
  ENV_PATH,
  `# Auto-generated by deploy-tradex-hub.ts\n# WARNING: Contains secret keys. Never commit!\n\n${envContent}\n`,
);

// Also update root .env with VITE_TRADEX_HUB_CONTRACT_ID for SGS frontend
const rootEnvPath = join(PROJECT_DIR, ".env");
if (existsSync(rootEnvPath)) {
  const rootEnvRaw = require("fs").readFileSync(rootEnvPath, "utf-8");
  const viteKey = "VITE_TRADEX_HUB_CONTRACT_ID";
  if (rootEnvRaw.includes(viteKey)) {
    // Replace existing line
    const updated = rootEnvRaw.replace(
      new RegExp(`^${viteKey}=.*$`, "m"),
      `${viteKey}=${contractId}`,
    );
    require("fs").writeFileSync(rootEnvPath, updated);
  } else {
    // Append after contract IDs block
    require("fs").appendFileSync(rootEnvPath, `\n${viteKey}=${contractId}\n`);
  }
  console.log(`  Also updated root .env with ${viteKey}`);
}

console.log(`
============================================
  Tradex-Hub Deployment Complete!
============================================

Contract ID:        ${contractId}
Admin Address:      ${adminAddress}
Attestor Pubkey:    ${attestorPubkeyHex}
Network:            ${NETWORK}

Saved to: ${ENV_PATH}
`);
