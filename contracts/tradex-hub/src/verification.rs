use soroban_sdk::{Bytes, Env};
use ultrahonk_soroban_verifier::{UltraHonkVerifier, PROOF_BYTES};

use crate::errors::Error;

pub fn verify_with_vk(
    env: &Env,
    vk_bytes: &Bytes,
    public_inputs: &Bytes,
    proof_bytes: &Bytes,
) -> Result<(), Error> {
    if proof_bytes.len() as usize != PROOF_BYTES {
        return Err(Error::ProofParseError);
    }

    let verifier = UltraHonkVerifier::new(env, vk_bytes).map_err(|_| Error::VkParseError)?;

    verifier
        .verify(proof_bytes, public_inputs)
        .map_err(|_| Error::ProofVerificationFailed)?;

    Ok(())
}

pub fn parse_badge_type(public_inputs: &Bytes) -> Result<u32, Error> {
    if public_inputs.len() != 128 {
        return Err(Error::InvalidPublicInputs);
    }
    // [player_id: 32][badge_type: 32][badge_threshold: 32][attestation_hash: 32]
    Ok(bytes_to_u32(public_inputs, 32))
}

fn bytes_to_u32(data: &Bytes, offset: u32) -> u32 {
    let b0 = data.get(offset + 28).unwrap_or(0) as u32;
    let b1 = data.get(offset + 29).unwrap_or(0) as u32;
    let b2 = data.get(offset + 30).unwrap_or(0) as u32;
    let b3 = data.get(offset + 31).unwrap_or(0) as u32;
    (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
}
