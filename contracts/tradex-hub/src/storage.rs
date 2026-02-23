use soroban_sdk::{contracttype, Address, Bytes, BytesN, Env};

use crate::errors::Error;
use crate::types::{BadgeRecord, PlayerStats};

#[contracttype]
pub enum DataKey {
    Admin,
    BadgeVk,
    Attestor,
    GameHub,
    SessionCounter,
    Player(Address),
    /// Maps player → GameHub session_id for close_account
    PlayerSession(Address),
    BadgeMeta(u32),
    /// Maps (player, badge_type) → token_id for duplicate prevention
    BadgeByType(Address, u32),
}

// ~30 days at 5s/block
const TTL_LEDGERS: u32 = 518_400;
const BUMP_AMOUNT: u32 = 518_400;

// -- Instance storage helpers --

pub fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_LEDGERS, BUMP_AMOUNT);
}

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    let admin = get_admin(env);
    if *caller != admin {
        return Err(Error::NotAdmin);
    }
    caller.require_auth();
    Ok(())
}

// -- Badge VK helpers --

pub fn get_badge_vk(env: &Env) -> Result<Bytes, Error> {
    env.storage()
        .instance()
        .get(&DataKey::BadgeVk)
        .ok_or(Error::BadgeVkNotSet)
}

pub fn set_badge_vk(env: &Env, vk: &Bytes) {
    env.storage().instance().set(&DataKey::BadgeVk, vk);
}

// -- Attestor helpers --

pub fn set_attestor(env: &Env, key: &BytesN<32>) {
    env.storage().instance().set(&DataKey::Attestor, key);
}

// -- Player helpers (persistent with TTL bump) --

pub fn get_player(env: &Env, addr: &Address) -> Option<PlayerStats> {
    let key = DataKey::Player(addr.clone());
    let stats: Option<PlayerStats> = env.storage().persistent().get(&key);
    if stats.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_LEDGERS, BUMP_AMOUNT);
    }
    stats
}

pub fn set_player(env: &Env, addr: &Address, stats: &PlayerStats) {
    let key = DataKey::Player(addr.clone());
    env.storage().persistent().set(&key, stats);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_LEDGERS, BUMP_AMOUNT);
}

// -- Badge metadata helpers (persistent, keyed by NFT token_id) --

pub fn get_badge_meta(env: &Env, token_id: u32) -> Option<BadgeRecord> {
    let key = DataKey::BadgeMeta(token_id);
    let record: Option<BadgeRecord> = env.storage().persistent().get(&key);
    if record.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_LEDGERS, BUMP_AMOUNT);
    }
    record
}

pub fn set_badge_meta(env: &Env, token_id: u32, record: &BadgeRecord) {
    let key = DataKey::BadgeMeta(token_id);
    env.storage().persistent().set(&key, record);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_LEDGERS, BUMP_AMOUNT);
}

// -- Badge-by-type index (for duplicate prevention) --

pub fn get_badge_token_by_type(env: &Env, player: &Address, badge_type: u32) -> Option<u32> {
    let key = DataKey::BadgeByType(player.clone(), badge_type);
    let token_id: Option<u32> = env.storage().persistent().get(&key);
    if token_id.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_LEDGERS, BUMP_AMOUNT);
    }
    token_id
}

pub fn set_badge_token_by_type(env: &Env, player: &Address, badge_type: u32, token_id: u32) {
    let key = DataKey::BadgeByType(player.clone(), badge_type);
    env.storage().persistent().set(&key, &token_id);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_LEDGERS, BUMP_AMOUNT);
}

// -- GameHub helpers --

pub fn get_game_hub(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::GameHub).unwrap()
}

pub fn set_game_hub(env: &Env, addr: &Address) {
    env.storage().instance().set(&DataKey::GameHub, addr);
}

pub fn next_session_id(env: &Env) -> u32 {
    let counter: u32 = env.storage().instance().get(&DataKey::SessionCounter).unwrap_or(0);
    let next = counter + 1;
    env.storage().instance().set(&DataKey::SessionCounter, &next);
    next
}

pub fn get_player_session(env: &Env, player: &Address) -> Option<u32> {
    let key = DataKey::PlayerSession(player.clone());
    env.storage().persistent().get(&key)
}

pub fn set_player_session(env: &Env, player: &Address, session_id: u32) {
    let key = DataKey::PlayerSession(player.clone());
    env.storage().persistent().set(&key, &session_id);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_LEDGERS, BUMP_AMOUNT);
}
