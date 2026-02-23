#![no_std]

mod errors;
mod events;
mod storage;
mod types;
mod verification;

use soroban_sdk::{contract, contractclient, contractimpl, Address, Bytes, BytesN, Env, String};
use stellar_tokens::non_fungible::{burnable::NonFungibleBurnable, Base, NonFungibleToken};

use errors::Error;
use types::{BadgeRecord, PlayerStats};

// GameHub contract interface (CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG)
#[contractclient(name = "GameHubClient")]
pub trait GameHub {
    fn start_game(
        env: Env,
        game_id: Address,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
    );

    fn end_game(env: Env, session_id: u32, player1_won: bool);
}

/// Minimum badges to "win" when closing account
const WIN_BADGE_THRESHOLD: u32 = 5;

#[contract]
pub struct TradexHub;

#[contractimpl]
impl TradexHub {
    pub fn __constructor(env: Env, admin: Address, attestor_pubkey: BytesN<32>, game_hub: Address) {
        env.storage()
            .instance()
            .set(&storage::DataKey::Admin, &admin);
        storage::set_attestor(&env, &attestor_pubkey);
        storage::set_game_hub(&env, &game_hub);

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

    pub fn register_player(
        env: Env,
        admin: Address,
        player: Address,
    ) -> Result<PlayerStats, Error> {
        storage::require_admin(&env, &admin)?;

        storage::bump_instance(&env);

        if let Some(stats) = storage::get_player(&env, &player) {
            return Ok(stats);
        }

        let stats = PlayerStats {
            total_sessions: 0,
            verified_sessions: 0,
            total_pnl_cents: 0,
            registered_at: env.ledger().timestamp(),
        };
        storage::set_player(&env, &player, &stats);

        // Register with GameHub: start a session with 0 points
        let game_hub_addr = storage::get_game_hub(&env);
        let game_hub = GameHubClient::new(&env, &game_hub_addr);
        let session_id = storage::next_session_id(&env);

        game_hub.start_game(
            &env.current_contract_address(), // game_id = this contract
            &session_id,
            &player,                         // player1 = the player
            &env.current_contract_address(), // player2 = this contract (placeholder)
            &0i128,                          // player1_points = 0
            &0i128,                          // player2_points = 0
        );

        storage::set_player_session(&env, &player, session_id);

        Ok(stats)
    }

    // -- Close account (ends GameHub session) --

    pub fn close_account(env: Env, player: Address) -> Result<bool, Error> {
        player.require_auth();
        storage::bump_instance(&env);

        let session_id =
            storage::get_player_session(&env, &player).ok_or(Error::PlayerNotRegistered)?;

        let game_hub_addr = storage::get_game_hub(&env);
        let game_hub = GameHubClient::new(&env, &game_hub_addr);

        // Player "wins" if they earned enough badges
        let badge_count = Base::balance(&env, &player);
        let player_won = badge_count >= WIN_BADGE_THRESHOLD;

        game_hub.end_game(&session_id, &player_won);

        Ok(player_won)
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
        if let Some(existing_token_id) = storage::get_badge_token_by_type(&env, &player, badge_type)
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
