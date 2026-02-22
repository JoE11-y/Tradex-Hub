#!/usr/bin/env bash
set -euo pipefail

# Build the badge_proof Noir circuit: compile, generate VK, optionally generate test proof
# Usage: ./scripts/build-badge-circuit.sh [--prove]

CIRCUIT_DIR="$(cd "$(dirname "$0")/../circuits/badge_proof" && pwd)"
TARGET="$CIRCUIT_DIR/target"

echo "==> Compiling badge_proof circuit..."
nargo compile --program-dir "$CIRCUIT_DIR"

JSON="$TARGET/badge_proof.json"
if [ ! -f "$JSON" ]; then
  echo "ERROR: Compiled circuit not found at $JSON"
  exit 1
fi

echo "==> Generating verification key..."
bb write_vk -b "$JSON" -o "$TARGET" \
  --scheme ultra_honk \
  --oracle_hash keccak \
  --output_format bytes_and_fields

# bb may create target/vk/vk (directory with file inside) -- flatten it
if [ -d "$TARGET/vk" ] && [ -f "$TARGET/vk/vk" ]; then
  mv "$TARGET/vk/vk" "$TARGET/vk_bytes"
  rmdir "$TARGET/vk"
  mv "$TARGET/vk_bytes" "$TARGET/vk"
  echo "  (flattened vk directory)"
fi

echo "==> VK written to $TARGET/vk"
echo "  VK size: $(wc -c < "$TARGET/vk") bytes"

# Optional: generate a test proof with the sample Prover.toml
if [ "${1:-}" = "--prove" ]; then
  echo "==> Executing circuit witness..."
  nargo execute --program-dir "$CIRCUIT_DIR"

  GZ="$TARGET/badge_proof.gz"
  if [ ! -f "$GZ" ]; then
    echo "ERROR: Witness not found at $GZ"
    exit 1
  fi

  echo "==> Generating proof..."
  bb prove -b "$JSON" -w "$GZ" -o "$TARGET" \
    --scheme ultra_honk \
    --oracle_hash keccak \
    --output_format bytes_and_fields

  echo "==> Proof generated"
  echo "  Proof size: $(wc -c < "$TARGET/proof") bytes"

  # Verify the proof locally
  echo "==> Verifying proof locally..."
  bb verify -p "$TARGET/proof" -k "$TARGET/vk" -i "$TARGET/public_inputs" \
    --scheme ultra_honk \
    --oracle_hash keccak
  echo "  Proof verified successfully!"
fi

echo "==> Done!"
