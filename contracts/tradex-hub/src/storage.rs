use soroban_sdk::{contracttype, Address, Bytes, BytesN, Env, String};

use crate::errors::Error;
use crate::types::{BadgeRecord, PlayerStats};

#[contracttype]
pub enum DataKey {
    Admin,
    BadgeVk,
    Attestor,
    Player(Address),
    Badge(Address, String),
    BadgeCount(Address),
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

pub fn get_attestor(env: &Env) -> Result<BytesN<32>, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Attestor)
        .ok_or(Error::AttestorNotSet)
}

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

// -- Badge helpers (persistent with TTL bump) --

pub fn get_badge(env: &Env, addr: &Address, id: &String) -> Option<BadgeRecord> {
    let key = DataKey::Badge(addr.clone(), id.clone());
    let badge: Option<BadgeRecord> = env.storage().persistent().get(&key);
    if badge.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_LEDGERS, BUMP_AMOUNT);
    }
    badge
}

pub fn set_badge(env: &Env, addr: &Address, id: &String, record: &BadgeRecord) {
    let key = DataKey::Badge(addr.clone(), id.clone());
    env.storage().persistent().set(&key, record);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_LEDGERS, BUMP_AMOUNT);
}

// -- Badge count (persistent with TTL bump) --

pub fn get_badge_count(env: &Env, addr: &Address) -> u32 {
    let key = DataKey::BadgeCount(addr.clone());
    let count: u32 = env.storage().persistent().get(&key).unwrap_or(0);
    if count > 0 {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_LEDGERS, BUMP_AMOUNT);
    }
    count
}

pub fn increment_badge_count(env: &Env, addr: &Address) {
    let key = DataKey::BadgeCount(addr.clone());
    let count: u32 = env.storage().persistent().get(&key).unwrap_or(0);
    env.storage().persistent().set(&key, &(count + 1));
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_LEDGERS, BUMP_AMOUNT);
}
