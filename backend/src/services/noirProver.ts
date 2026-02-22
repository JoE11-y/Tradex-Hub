/**
 * In-process Noir proof generation using @noir-lang/noir_js and @aztec/bb.js.
 *
 * Replaces CLI-based nargo execute + bb prove pipeline with programmatic API.
 * Matches the approach used by ProofBridge.
 */
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { CONFIG } from '../config';

// Circuit JSON type (compiled Noir output)
interface CompiledCircuit {
  noir_version: string;
  hash: string;
  abi: {
    parameters: Array<{ name: string; type: { kind: string }; visibility: string }>;
    return_type: null | { kind: string };
  };
  bytecode: string;
}

// Cached instances per circuit
interface CircuitInstance {
  noir: Noir;
  backend: UltraHonkBackend;
}

const circuitCache = new Map<string, CircuitInstance>();

/** Load and cache a compiled circuit */
function getCircuit(circuitDir: string, circuitName: string): CircuitInstance {
  const cacheKey = `${circuitDir}:${circuitName}`;
  const cached = circuitCache.get(cacheKey);
  if (cached) return cached;

  const jsonPath = join(circuitDir, 'target', `${circuitName}.json`);
  let raw: string;
  try {
    raw = readFileSync(jsonPath, 'utf-8');
  } catch {
    throw new Error(
      `Circuit not compiled. Run: cd ${circuitDir} && nargo compile\n` +
      `Expected compiled circuit at: ${jsonPath}`,
    );
  }
  const circuit: CompiledCircuit = JSON.parse(raw);

  const noir = new Noir(circuit as Parameters<typeof Noir>[0]);
  const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });

  const instance: CircuitInstance = { noir, backend };
  circuitCache.set(cacheKey, instance);

  console.log(`[noirProver] Loaded circuit: ${circuitName} (noir ${circuit.noir_version})`);
  return instance;
}

export interface ProofResult {
  proofHex: string;
  publicInputsHex: string;
}

export const noirProver = {
  /**
   * Generate a proof for the badge_proof circuit.
   */
  async generateBadgeProof(inputs: Record<string, string>): Promise<ProofResult> {
    const circuitDir = resolve(CONFIG.BADGE_CIRCUIT_DIR);
    const { noir, backend } = getCircuit(circuitDir, 'badge_proof');

    console.log('[noirProver] Executing badge_proof witness...');
    const { witness } = await noir.execute(inputs);

    console.log('[noirProver] Generating badge_proof proof...');
    const { proof, publicInputs } = await backend.generateProof(witness, { keccak: true });

    const proofHex = Buffer.from(proof).toString('hex');
    const publicInputsHex = publicInputsToBytes(publicInputs);

    console.log(`[noirProver] Badge proof: ${proof.byteLength} bytes, ${publicInputs.length} public inputs`);

    return { proofHex, publicInputsHex };
  },
};

/**
 * Convert public inputs (hex string array from bb.js) to a single hex string
 * matching the on-chain format: each field element is 32 bytes big-endian.
 */
function publicInputsToBytes(publicInputs: string[]): string {
  const buffers = publicInputs.map((pi) => {
    // Each public input is a hex string (with or without 0x prefix)
    const hex = pi.startsWith('0x') ? pi.slice(2) : pi;
    const buf = Buffer.from(hex.padStart(64, '0'), 'hex');
    // Take last 32 bytes if longer (shouldn't happen, but safety)
    return buf.length > 32 ? buf.subarray(buf.length - 32) : buf;
  });
  return Buffer.concat(buffers).toString('hex');
}
