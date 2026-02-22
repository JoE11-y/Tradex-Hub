#![no_std]

mod errors;
mod events;
mod storage;
mod types;
mod verification;

use soroban_sdk::{contract, contractimpl, Address, Bytes, BytesN, Env, String};

use errors::Error;
use types::{BadgeRecord, PlayerStats};

#[contract]
pub struct TradexHub;

#[contractimpl]
impl TradexHub {
    pub fn __constructor(
        env: Env,
        admin: Address,
        attestor_pubkey: BytesN<32>,
    ) {
        env.storage()
            .instance()
            .set(&storage::DataKey::Admin, &admin);
        storage::set_attestor(&env, &attestor_pubkey);
        storage::bump_instance(&env);
    }

    // -- Player management --

    pub fn register_player(env: Env, player: Address) -> PlayerStats {
        player.require_auth();
        storage::bump_instance(&env);

        if let Some(stats) = storage::get_player(&env, &player) {
            return stats;
        }

        let stats = PlayerStats {
            total_sessions: 0,
            verified_sessions: 0,
            total_pnl_cents: 0,
            registered_at: env.ledger().timestamp(),
        };
        storage::set_player(&env, &player, &stats);
        stats
    }

    // -- Badges (server-minted with ZK proof, admin auth) --

    pub fn mint_badge(
        env: Env,
        admin: Address,
        player: Address,
        badge_id: String,
        name: String,
        badge_type: u32,
        public_inputs: Bytes,
        proof_bytes: Bytes,
    ) -> Result<BadgeRecord, Error> {
        storage::require_admin(&env, &admin)?;
        storage::bump_instance(&env);

        if let Some(existing) = storage::get_badge(&env, &player, &badge_id) {
            return Ok(existing);
        }

        let badge_vk = storage::get_badge_vk(&env)?;
        verification::verify_with_vk(&env, &badge_vk, &public_inputs, &proof_bytes)?;

        let proof_badge_type = verification::parse_badge_type(&public_inputs)?;
        if proof_badge_type != badge_type {
            return Err(Error::InvalidPublicInputs);
        }
        // Validate badge type is within defined range (0-24: 10 level + 10 achievement + 5 education badges)
        if badge_type > 24 {
            return Err(Error::InvalidBadgeType);
        }

        let record = BadgeRecord {
            badge_id: badge_id.clone(),
            name,
            badge_type,
            earned_at: env.ledger().timestamp(),
        };
        storage::set_badge(&env, &player, &badge_id, &record);
        storage::increment_badge_count(&env, &player);
        events::emit_badge(&env, &player, &badge_id, badge_type);

        Ok(record)
    }

    pub fn has_badge(env: Env, player: Address, badge_id: String) -> bool {
        storage::get_badge(&env, &player, &badge_id).is_some()
    }

    // -- Queries --

    pub fn get_player(env: Env, player: Address) -> Option<PlayerStats> {
        storage::get_player(&env, &player)
    }

    pub fn get_badge_count(env: Env, player: Address) -> u32 {
        storage::get_badge_count(&env, &player)
    }

    // -- Admin --

    pub fn set_attestor(env: Env, pubkey: BytesN<32>) -> Result<(), Error> {
        storage::require_admin(&env, &storage::get_admin(&env))?;
        storage::bump_instance(&env);
        storage::set_attestor(&env, &pubkey);
        events::emit_attestor_rotated(&env, &pubkey);
        Ok(())
    }

    pub fn set_badge_vk(env: Env, vk_bytes: Bytes) -> Result<(), Error> {
        storage::require_admin(&env, &storage::get_admin(&env))?;
        storage::bump_instance(&env);
        storage::set_badge_vk(&env, &vk_bytes);
        events::emit_badge_vk_updated(&env);
        Ok(())
    }
}
