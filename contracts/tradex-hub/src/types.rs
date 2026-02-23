use soroban_sdk::{contracttype, String};

#[contracttype]
#[derive(Clone, Debug)]
pub struct PlayerStats {
    pub total_sessions: u32,
    pub verified_sessions: u32,
    pub total_pnl_cents: i128,
    pub registered_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct BadgeRecord {
    pub name: String,
    pub badge_type: u32,
    pub earned_at: u64,
}
