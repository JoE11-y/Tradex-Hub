#![no_std]

mod errors;
mod events;
mod storage;
mod types;
mod verification;

use soroban_sdk::{contract, contractimpl, Address, Bytes, BytesN, Env, String};
use stellar_tokens::non_fungible::{burnable::NonFungibleBurnable, Base, NonFungibleToken};

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

        // Initialize NFT collection metadata
        Base::set_metadata(
            &env,
            String::from_str(&env, "https://tradex.app/badges/"),
            String::from_str(&env, "Tradex Badges"),
            String::from_str(&env, "TXBDG"),
        );

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

    // -- Badges (server-minted as NFTs with ZK proof, admin auth) --

    pub fn mint_badge(
        env: Env,
        admin: Address,
        player: Address,
        name: String,
        badge_type: u32,
        public_inputs: Bytes,
        proof_bytes: Bytes,
    ) -> Result<u32, Error> {
        storage::require_admin(&env, &admin)?;
        storage::bump_instance(&env);

        // Check if player already has this badge type
        if let Some(existing_token_id) =
            storage::get_badge_token_by_type(&env, &player, badge_type)
        {
            return Ok(existing_token_id);
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

        // Mint NFT to player
        let token_id = Base::sequential_mint(&env, &player);

        // Store badge metadata keyed by token_id
        let record = BadgeRecord {
            name,
            badge_type,
            earned_at: env.ledger().timestamp(),
        };
        storage::set_badge_meta(&env, token_id, &record);
        storage::set_badge_token_by_type(&env, &player, badge_type, token_id);

        Ok(token_id)
    }

    pub fn has_badge(env: Env, player: Address, badge_type: u32) -> bool {
        storage::get_badge_token_by_type(&env, &player, badge_type).is_some()
    }

    // -- Queries --

    pub fn get_player(env: Env, player: Address) -> Option<PlayerStats> {
        storage::get_player(&env, &player)
    }

    pub fn get_badge_count(env: Env, player: Address) -> u32 {
        Base::balance(&env, &player)
    }

    pub fn get_badge_meta(env: Env, token_id: u32) -> Option<BadgeRecord> {
        storage::get_badge_meta(&env, token_id)
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

// -- NFT trait implementations --

#[contractimpl(contracttrait)]
impl NonFungibleToken for TradexHub {
    type ContractType = Base;
}

#[contractimpl(contracttrait)]
impl NonFungibleBurnable for TradexHub {}
