use soroban_sdk::contracterror;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotAdmin = 1,
    PlayerNotRegistered = 2,
    ProofVerificationFailed = 5,
    InvalidPublicInputs = 6,
    AttestorNotSet = 8,
    VkParseError = 9,
    ProofParseError = 10,
    BadgeVkNotSet = 11,
    InvalidBadgeType = 12,
}
