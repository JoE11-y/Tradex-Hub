use soroban_sdk::{symbol_short, BytesN, Env};

pub fn emit_attestor_rotated(env: &Env, pubkey: &BytesN<32>) {
    env.events()
        .publish((symbol_short!("admin"),), (symbol_short!("attestor"), pubkey.clone()));
}

pub fn emit_badge_vk_updated(env: &Env) {
    env.events()
        .publish((symbol_short!("admin"),), (symbol_short!("bvk_set"),));
}
