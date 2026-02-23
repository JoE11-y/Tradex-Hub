#!/usr/bin/env bash
set -euo pipefail

# Deploy tradex-hub contract to Stellar testnet.
#
# Prerequisites:
#   1. Badge circuit compiled: ./scripts/build-badge-circuit.sh
#   2. stellar CLI installed
#   3. Admin identity created: stellar keys generate admin --network testnet
#
# Usage:
#   ./scripts/deploy-tradex-hub.sh                        # uses "admin" identity
#   ADMIN_KEY=mykey ./scripts/deploy-tradex-hub.sh        # uses named identity
#   ADMIN_SECRET=S... ./scripts/deploy-tradex-hub.sh      # uses raw secret key
#
# Environment variables:
#   ADMIN_KEY        - stellar CLI identity name (default: "admin")
#   ADMIN_SECRET     - raw Stellar secret key (S...), overrides ADMIN_KEY
#   ATTESTOR_SECRET  - hex Ed25519 secret for attestation (auto-generated if not set)
#   NETWORK          - stellar network alias (default: testnet)
#   SKIP_BUILD       - set to 1 to skip cargo build step

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACT_DIR="$PROJECT_DIR/contracts/tradex-hub"
BADGE_CIRCUIT_DIR="$PROJECT_DIR/circuits/badge_proof"
BACKEND_ENV="$PROJECT_DIR/backend/.env"

NETWORK="${NETWORK:-testnet}"
ADMIN_KEY="${ADMIN_KEY:-admin}"
RPC_URL="https://soroban-testnet.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# ── Resolve admin identity ──

# If ADMIN_SECRET is provided (raw S... key), use it directly as --source-account.
# Otherwise, resolve from the named identity via stellar keys.
if [ -n "${ADMIN_SECRET:-}" ]; then
  SOURCE_ACCOUNT="$ADMIN_SECRET"
  # Derive address from raw secret
  ADMIN_ADDRESS=$(stellar keys address "$ADMIN_SECRET" 2>/dev/null || echo "")
  if [ -z "$ADMIN_ADDRESS" ]; then
    echo "ERROR: Could not derive public key from ADMIN_SECRET."
    exit 1
  fi
  echo "==> Using raw secret key"
else
  SOURCE_ACCOUNT="$ADMIN_KEY"
  # Try to get address from named identity
  ADMIN_ADDRESS=$(stellar keys address "$ADMIN_KEY" 2>/dev/null || echo "")
  if [ -z "$ADMIN_ADDRESS" ]; then
    echo "ERROR: Identity '$ADMIN_KEY' not found."
    echo "  Create it:  stellar keys generate $ADMIN_KEY --network $NETWORK"
    echo "  Or pass:    ADMIN_SECRET=S... $0"
    exit 1
  fi
  # Retrieve the secret for .env output
  ADMIN_SECRET=$(stellar keys show "$ADMIN_KEY" 2>/dev/null || echo "")
  echo "==> Using identity '$ADMIN_KEY'"
fi

echo "==> Admin address: $ADMIN_ADDRESS"
echo "==> Network: $NETWORK"

# ── Ensure admin is funded ──

echo ""
echo "==> Checking admin account..."
FUNDED=$(curl -s -o /dev/null -w "%{http_code}" "https://horizon-testnet.stellar.org/accounts/$ADMIN_ADDRESS" 2>/dev/null || echo "000")
if [ "$FUNDED" = "404" ]; then
  echo "  Account not found, funding via Friendbot..."
  FUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://friendbot.stellar.org?addr=$ADMIN_ADDRESS")
  if [ "$FUND_STATUS" != "200" ]; then
    echo "WARNING: Friendbot returned $FUND_STATUS (may already be funded or rate-limited)"
  fi
  # Wait for account to appear
  for i in $(seq 1 10); do
    sleep 1
    CHECK=$(curl -s -o /dev/null -w "%{http_code}" "https://horizon-testnet.stellar.org/accounts/$ADMIN_ADDRESS" 2>/dev/null || echo "000")
    if [ "$CHECK" = "200" ]; then
      echo "  Admin funded"
      break
    fi
    if [ "$i" = "10" ]; then
      echo "WARNING: Account may not be funded yet, proceeding anyway..."
    fi
  done
elif [ "$FUNDED" = "200" ]; then
  echo "  Admin already funded"
else
  echo "  Could not check account status (HTTP $FUNDED), proceeding..."
fi

# ── Step 1: Build contract ──

WASM_PATH="$CONTRACT_DIR/target/wasm32v1-none/release/tradex_hub.wasm"

if [ "${SKIP_BUILD:-}" != "1" ]; then
  echo ""
  echo "==> Building tradex-hub contract (clean)..."
  (cd "$PROJECT_DIR" && cargo build --release --target wasm32v1-none -p tradex-hub)
else
  echo ""
  echo "==> Skipping build (SKIP_BUILD=1)"
fi

if [ ! -f "$WASM_PATH" ]; then
  echo "ERROR: WASM not found at $WASM_PATH"
  echo "  Run without SKIP_BUILD=1, or build manually:"
  echo "  cd $CONTRACT_DIR && cargo build --release --target wasm32v1-none"
  exit 1
fi

echo "==> WASM size: $(wc -c < "$WASM_PATH") bytes"

# Optimize
echo "==> Optimizing WASM..."
stellar contract optimize --wasm "$WASM_PATH" 2>/dev/null || true
OPTIMIZED_PATH="${WASM_PATH%.wasm}.optimized.wasm"
if [ -f "$OPTIMIZED_PATH" ]; then
  WASM_PATH="$OPTIMIZED_PATH"
  echo "  Optimized WASM: $(wc -c < "$WASM_PATH") bytes"
fi

# ── Step 2: Read badge VK bytes ──

BADGE_VK="$BADGE_CIRCUIT_DIR/target/vk"

if [ ! -f "$BADGE_VK" ]; then
  echo "ERROR: Badge VK not found at $BADGE_VK"
  echo "  Run: ./scripts/build-badge-circuit.sh"
  exit 1
fi

BADGE_VK_HEX=$(xxd -p "$BADGE_VK" | tr -d '\n')

echo "==> Badge VK: $(wc -c < "$BADGE_VK") bytes"

# ── Step 3: Generate or use attestor keypair ──

if [ -n "${ATTESTOR_SECRET:-}" ]; then
  echo "==> Using provided ATTESTOR_SECRET"
  ATTESTOR_SECRET_HEX="$ATTESTOR_SECRET"
else
  echo "==> Generating Ed25519 attestor keypair..."
  ATTESTOR_SECRET_HEX=$(openssl rand -hex 32)
fi

# Derive public key from secret
ATTESTOR_PUBKEY_HEX=$(echo "$ATTESTOR_SECRET_HEX" | \
  python3 -c "
import sys
secret = bytes.fromhex(sys.stdin.read().strip())
try:
    from nacl.signing import SigningKey
    sk = SigningKey(secret)
    print(sk.verify_key.encode().hex())
except ImportError:
    import subprocess
    der_prefix = b'\\x30\\x2e\\x02\\x01\\x00\\x30\\x05\\x06\\x03\\x2b\\x65\\x70\\x04\\x22\\x04\\x20'
    result = subprocess.run(
        ['openssl', 'pkey', '-inform', 'DER', '-outform', 'DER', '-pubout'],
        input=der_prefix + secret, capture_output=True
    )
    print(result.stdout[-32:].hex())
" 2>/dev/null || echo "")

if [ -z "$ATTESTOR_PUBKEY_HEX" ]; then
  echo "ERROR: Could not derive attestor public key."
  echo "  Install pynacl: pip install pynacl"
  exit 1
fi

echo "==> Attestor public key: $ATTESTOR_PUBKEY_HEX"

# ── Step 4: Deploy contract ──

echo ""
echo "==> Installing WASM on $NETWORK..."
INSTALL_OUTPUT=$(stellar contract upload \
  --wasm "$WASM_PATH" \
  --source-account "$SOURCE_ACCOUNT" \
  --network "$NETWORK" \
  --inclusion-fee 10000000 2>&1)
WASM_HASH=$(echo "$INSTALL_OUTPUT" | tail -1)
echo "$INSTALL_OUTPUT"
echo "  WASM hash: $WASM_HASH"

echo "==> Deploying tradex-hub with constructor args..."
echo ""
echo "────────────────────────────────────────"
echo "  Run this command manually if it hangs:"
echo "────────────────────────────────────────"
echo "stellar contract deploy \\"
echo "  --wasm-hash $WASM_HASH \\"
echo "  --source-account $SOURCE_ACCOUNT \\"
echo "  --network $NETWORK \\"
echo "  --inclusion-fee 10000000 \\"
echo "  -- \\"
echo "  --admin $ADMIN_ADDRESS \\"
echo "  --attestor_pubkey $ATTESTOR_PUBKEY_HEX"
echo "────────────────────────────────────────"
echo ""

DEPLOY_OUTPUT=$(stellar contract deploy \
  --wasm-hash "$WASM_HASH" \
  --source-account "$SOURCE_ACCOUNT" \
  --network "$NETWORK" \
  --inclusion-fee 10000000 \
  -- \
  --admin "$ADMIN_ADDRESS" \
  --attestor_pubkey "$ATTESTOR_PUBKEY_HEX" 2>&1)
DEPLOY_EXIT=$?
echo "$DEPLOY_OUTPUT"
if [ $DEPLOY_EXIT -ne 0 ]; then
  echo "ERROR: Deploy failed (exit $DEPLOY_EXIT)"
  echo ""
  echo "If the deploy timed out, you can set CONTRACT_ID manually and run set_badge_vk:"
  echo ""
  echo "stellar contract invoke \\"
  echo "  --id <CONTRACT_ID> \\"
  echo "  --source-account $SOURCE_ACCOUNT \\"
  echo "  --network $NETWORK \\"
  echo "  --inclusion-fee 10000000 \\"
  echo "  -- \\"
  echo "  set_badge_vk \\"
  echo "  --vk_bytes $BADGE_VK_HEX"
  exit 1
fi
CONTRACT_ID=$(echo "$DEPLOY_OUTPUT" | tail -1)

echo "==> tradex-hub deployed: $CONTRACT_ID"

# ── Step 5: Set badge VK ──

echo "==> Setting badge VK..."
echo ""
echo "────────────────────────────────────────"
echo "  Run this command manually if it hangs:"
echo "────────────────────────────────────────"
echo "stellar contract invoke \\"
echo "  --id $CONTRACT_ID \\"
echo "  --source-account $SOURCE_ACCOUNT \\"
echo "  --network $NETWORK \\"
echo "  --inclusion-fee 10000000 \\"
echo "  -- \\"
echo "  set_badge_vk \\"
echo "  --vk_bytes $BADGE_VK_HEX"
echo "────────────────────────────────────────"
echo ""

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$SOURCE_ACCOUNT" \
  --network "$NETWORK" \
  --inclusion-fee 10000000 \
  -- \
  set_badge_vk \
  --vk_bytes "$BADGE_VK_HEX"

echo "==> Badge VK set successfully"

# ── Step 6: Write backend .env ──

echo ""
echo "==> Writing to $BACKEND_ENV..."

# Preserve existing env vars not managed by this script
declare -A ENV_VARS
if [ -f "$BACKEND_ENV" ]; then
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    ENV_VARS["$key"]="$value"
  done < "$BACKEND_ENV"
fi

# Set/overwrite deploy-managed keys
ENV_VARS[TRADEX_HUB_CONTRACT_ID]="$CONTRACT_ID"
ENV_VARS[SERVER_SECRET_KEY]="$ADMIN_SECRET"
ENV_VARS[ATTESTOR_SECRET_KEY]="$ATTESTOR_SECRET_HEX"
ENV_VARS[STELLAR_RPC_URL]="$RPC_URL"
ENV_VARS[STELLAR_NETWORK_PASSPHRASE]="$NETWORK_PASSPHRASE"

{
  echo "# Auto-generated by deploy-tradex-hub.sh"
  echo "# WARNING: Contains secret keys. Never commit!"
  echo ""
  for key in $(echo "${!ENV_VARS[@]}" | tr ' ' '\n' | sort); do
    echo "$key=${ENV_VARS[$key]}"
  done
} > "$BACKEND_ENV"

echo "  Saved"

# Also update root .env VITE_TRADEX_HUB_CONTRACT_ID if it exists
ROOT_ENV="$PROJECT_DIR/.env"
if [ -f "$ROOT_ENV" ]; then
  VITE_KEY="VITE_TRADEX_HUB_CONTRACT_ID"
  if grep -q "^$VITE_KEY=" "$ROOT_ENV" 2>/dev/null; then
    sed -i "s|^${VITE_KEY}=.*|${VITE_KEY}=${CONTRACT_ID}|" "$ROOT_ENV"
  else
    echo "" >> "$ROOT_ENV"
    echo "$VITE_KEY=$CONTRACT_ID" >> "$ROOT_ENV"
  fi
  echo "  Updated root .env with $VITE_KEY"
fi

# ── Output ──

echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo ""
echo "Contract ID:        $CONTRACT_ID"
echo "Admin Address:      $ADMIN_ADDRESS"
echo "Attestor Pubkey:    $ATTESTOR_PUBKEY_HEX"
echo "Network:            $NETWORK"
echo ""
echo "Backend .env:       $BACKEND_ENV"
echo ""
