import {
  Keypair,
  TransactionBuilder,
  Networks,
  Address,
  xdr,
  nativeToScVal,
  rpc,
  Operation,
  BASE_FEE,
  scValToNative,
} from "@stellar/stellar-sdk";
import { CONFIG } from "../config";

const TIMEOUT_SEC = 30;

function getServer(): rpc.Server {
  return new rpc.Server(CONFIG.STELLAR_RPC_URL);
}

function getServerKeypair(): Keypair {
  if (!CONFIG.SERVER_SECRET_KEY) {
    throw new Error("SERVER_SECRET_KEY not configured");
  }
  return Keypair.fromSecret(CONFIG.SERVER_SECRET_KEY);
}

function getNetworkPassphrase(): string {
  return CONFIG.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
}

function getContractId(): string {
  if (!CONFIG.TRADEX_HUB_CONTRACT_ID) {
    throw new Error("TRADEX_HUB_CONTRACT_ID not configured");
  }
  return CONFIG.TRADEX_HUB_CONTRACT_ID;
}

/** Convert hex string to Soroban Bytes */
function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

/** Build, simulate, sign, and submit a Soroban contract invocation */
async function invokeContract(
  functionName: string,
  args: xdr.ScVal[],
  signerKeypair: Keypair,
): Promise<{ txHash: string; returnVal: xdr.ScVal | undefined }> {
  const server = getServer();
  const contractId = getContractId();
  const networkPassphrase = getNetworkPassphrase();
  const sourcePublicKey = signerKeypair.publicKey();

  // Load account
  const account = await server.getAccount(sourcePublicKey);

  // Build transaction with contract invocation
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: functionName,
        args,
      }),
    )
    .setTimeout(TIMEOUT_SEC)
    .build();

  // Simulate to get resource estimates
  const simResponse = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simResponse)) {
    const errMsg =
      "error" in simResponse ? String(simResponse.error) : "Simulation failed";
    throw new Error(`Soroban simulation failed for ${functionName}: ${errMsg}`);
  }

  // Assemble with simulation results (adds resource footprint, auth)
  const assembled = rpc.assembleTransaction(tx, simResponse).build();

  // Sign
  assembled.sign(signerKeypair);

  // Submit
  const sendResponse = await server.sendTransaction(assembled);
  if (sendResponse.status === "ERROR") {
    throw new Error(`Transaction send failed: ${JSON.stringify(sendResponse)}`);
  }

  // Poll for result
  const txHash = sendResponse.hash;
  let getResponse = await server.getTransaction(txHash);

  const maxAttempts = 30;
  for (
    let attempt = 0;
    attempt < maxAttempts && getResponse.status === "NOT_FOUND";
    attempt++
  ) {
    await new Promise((r) => setTimeout(r, 1000));
    getResponse = await server.getTransaction(txHash);
  }

  if (getResponse.status === "NOT_FOUND") {
    throw new Error(`Transaction ${txHash} not found after ${maxAttempts}s`);
  }

  if (getResponse.status === "FAILED") {
    let detail = "";
    try {
      const resultXdr = (
        getResponse as { resultXdr?: { toXDR?: (fmt: string) => string } }
      ).resultXdr;
      if (resultXdr && typeof resultXdr.toXDR === "function") {
        detail = ` | resultXdr: ${resultXdr.toXDR("base64")}`;
      }
    } catch {
      /* ignore parse errors */
    }
    throw new Error(`Transaction ${txHash} failed on-chain${detail}`);
  }

  const returnVal = getResponse.returnValue;
  return { txHash, returnVal };
}

export const sorobanClient = {
  /** Check if Soroban client is configured */
  isConfigured(): boolean {
    return !!(CONFIG.TRADEX_HUB_CONTRACT_ID && CONFIG.SERVER_SECRET_KEY);
  },

  /** Mint a badge NFT on-chain via mint_badge (server submits on behalf of player) */
  async mintBadge(
    playerWalletAddress: string,
    badgeName: string,
    badgeType: number,
    publicInputsHex: string,
    proofHex: string,
  ): Promise<{ txHash: string; tokenId: number }> {
    const keypair = getServerKeypair();

    const args = [
      new Address(keypair.publicKey()).toScVal(), // admin
      new Address(playerWalletAddress).toScVal(), // player
      nativeToScVal(badgeName, { type: "string" }), // name
      nativeToScVal(badgeType, { type: "u32" }), // badge_type
      xdr.ScVal.scvBytes(hexToBytes(publicInputsHex)), // public_inputs
      xdr.ScVal.scvBytes(hexToBytes(proofHex)), // proof_bytes
    ];

    const { txHash, returnVal } = await invokeContract("mint_badge", args, keypair);

    // Contract returns Result<u32, Error> — extract token_id
    let tokenId = 0;
    if (returnVal) {
      try {
        tokenId = scValToNative(returnVal) as number;
      } catch {
        console.warn("[sorobanClient] Could not parse token_id from return value");
      }
    }

    console.log(`[sorobanClient] mint_badge tx: ${txHash}, tokenId: ${tokenId}`);
    return { txHash, tokenId };
  },

};
