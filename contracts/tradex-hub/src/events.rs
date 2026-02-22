use soroban_sdk::{symbol_short, Address, BytesN, Env, String};

pub fn emit_badge(env: &Env, player: &Address, badge_id: &String, badge_type: u32) {
    env.events().publish(
        (symbol_short!("badge"), player.clone()),
        (badge_id.clone(), badge_type),
    );
}

pub fn emit_attestor_rotated(env: &Env, pubkey: &BytesN<32>) {
    env.events()
        .publish((symbol_short!("admin"),), (symbol_short!("attestor"), pubkey.clone()));
}

pub fn emit_badge_vk_updated(env: &Env) {
    env.events()
        .publish((symbol_short!("admin"),), (symbol_short!("bvk_set"),));
}
