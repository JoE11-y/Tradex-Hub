// Badge Eligibility Verifier Circuit
//
// Proves a player meets the criteria for a specific badge without revealing
// their full stats. The server signs an attestation over the player's stats;
// this circuit verifies the attestation hash and checks the relevant threshold.
//
// Public inputs (verified on-chain):
//   player_id        - player identifier
//   badge_type       - numeric badge type (0-24)
//   badge_threshold  - the threshold value required for this badge
//   attestation_hash - polynomial hash of attested stats (server-signed commitment)
//
// Private inputs (from server attestation):
//   total_xp            - player's total XP
//   total_trades         - lifetime trade count
//   win_streak           - current win streak
//   longest_hold_ms      - longest position hold in ms
//   near_liq_closes      - near-liquidation close count
//   total_sessions       - session count
//   profitable_sessions  - sessions with positive PnL
//   verified_sessions    - ZK-verified session count
//   pattern_correct      - correct pattern identifications
//   pattern_streak       - best pattern identification streak
//   prediction_correct   - correct price predictions
//   credibility_score    - prediction credibility score (0-100)

fn main(
    // Public inputs
    player_id: pub Field,
    badge_type: pub Field,
    badge_threshold: pub Field,
    attestation_hash: pub Field,
    // Private inputs (server-attested stats)
    total_xp: Field,
    total_trades: Field,
    win_streak: Field,
    longest_hold_ms: Field,
    near_liq_closes: Field,
    total_sessions: Field,
    profitable_sessions: Field,
    verified_sessions: Field,
    pattern_correct: Field,
    pattern_streak: Field,
    prediction_correct: Field,
    credibility_score: Field,
) {
    // player_id is a public input committed to the proof but not constrained in-circuit.
    // It binds the proof to a specific player (verified by the contract).
    let _pid = player_id;

    // -- Constraint 1: Attestation hash verification --
    // Polynomial accumulator over all 12 stats (must match server computation).
    // running = running * 997 + stat for each stat, in order.
    let mut running: Field = 0;
    running = running * 997 + total_xp;
    running = running * 997 + total_trades;
    running = running * 997 + win_streak;
    running = running * 997 + longest_hold_ms;
    running = running * 997 + near_liq_closes;
    running = running * 997 + total_sessions;
    running = running * 997 + profitable_sessions;
    running = running * 997 + verified_sessions;
    running = running * 997 + pattern_correct;
    running = running * 997 + pattern_streak;
    running = running * 997 + prediction_correct;
    running = running * 997 + credibility_score;
    assert(running == attestation_hash, "attestation hash mismatch");

    // -- Constraint 2: Badge type selector routing --
    // For each badge type, assert the relevant stat >= badge_threshold.
    // We use a conditional accumulator: exactly one branch should match,
    // and the matched stat must be >= threshold.
    //
    // The "ge check" uses 32-bit decomposition: for a >= b, prove (a - b)
    // fits in 32 bits (no underflow in the field).

    // Types 0-9: level badges, check total_xp >= badge_threshold
    let mut matched: Field = 0;
    let mut stat_value: Field = 0;

    // Level badges (types 0-9): XP check
    for t in 0..10 {
        let is_match = eq(badge_type, t as Field);
        matched += is_match;
        stat_value += is_match * total_xp;
    }

    // Type 10: first_blood (total_trades >= 1)
    let m10 = eq(badge_type, 10);
    matched += m10;
    stat_value += m10 * total_trades;

    // Type 11: winning_streak (win_streak >= 5)
    let m11 = eq(badge_type, 11);
    matched += m11;
    stat_value += m11 * win_streak;

    // Type 12: diamond_hands (longest_hold_ms >= 600000)
    let m12 = eq(badge_type, 12);
    matched += m12;
    stat_value += m12 * longest_hold_ms;

    // Type 13: liquidation_survivor (near_liq_closes >= 3)
    let m13 = eq(badge_type, 13);
    matched += m13;
    stat_value += m13 * near_liq_closes;

    // Type 14: ten_trades (total_trades >= 10)
    let m14 = eq(badge_type, 14);
    matched += m14;
    stat_value += m14 * total_trades;

    // Type 15: profitable_session (profitable_sessions >= 1)
    let m15 = eq(badge_type, 15);
    matched += m15;
    stat_value += m15 * profitable_sessions;

    // Type 16: zk_verified (verified_sessions >= 1)
    let m16 = eq(badge_type, 16);
    matched += m16;
    stat_value += m16 * verified_sessions;

    // Type 17: fifty_trades (total_trades >= 50)
    let m17 = eq(badge_type, 17);
    matched += m17;
    stat_value += m17 * total_trades;

    // Type 18: century_trader (total_trades >= 100)
    let m18 = eq(badge_type, 18);
    matched += m18;
    stat_value += m18 * total_trades;

    // Type 19: iron_streak (win_streak >= 10)
    let m19 = eq(badge_type, 19);
    matched += m19;
    stat_value += m19 * win_streak;

    // Type 20: pattern_novice (pattern_correct >= 10)
    let m20 = eq(badge_type, 20);
    matched += m20;
    stat_value += m20 * pattern_correct;

    // Type 21: pattern_master (pattern_streak >= 25)
    let m21 = eq(badge_type, 21);
    matched += m21;
    stat_value += m21 * pattern_streak;

    // Type 22: prediction_novice (prediction_correct >= 10)
    let m22 = eq(badge_type, 22);
    matched += m22;
    stat_value += m22 * prediction_correct;

    // Type 23: prediction_master (credibility_score >= 80)
    let m23 = eq(badge_type, 23);
    matched += m23;
    stat_value += m23 * credibility_score;

    // Type 24: all_rounder - requires ALL three modules >= threshold
    // (total_trades >= 10 AND pattern_correct >= 10 AND prediction_correct >= 10)
    let m24 = eq(badge_type, 24);
    matched += m24;
    stat_value += m24 * total_trades;

    // Exactly one badge type must match
    assert(matched == 1, "badge_type must match exactly one known type");

    // -- Constraint 3: stat_value >= badge_threshold --
    // Prove (stat_value - badge_threshold) fits in 32 bits (non-negative).
    let diff = stat_value - badge_threshold;
    assert_fits_in_32_bits(diff);

    // -- Constraint 4 (all_rounder only): check all three module stats --
    // When m24 == 1 (all_rounder), enforce pattern_correct >= threshold AND prediction_correct >= threshold.
    // When m24 == 0, these become assert_fits_in_32_bits(0) which trivially passes.
    assert_fits_in_32_bits(m24 * (pattern_correct - badge_threshold));
    assert_fits_in_32_bits(m24 * (prediction_correct - badge_threshold));
}

/// Check if two Field values are equal, returning 1 if equal, 0 otherwise.
/// Uses the standard Noir equality pattern.
fn eq(a: Field, b: Field) -> Field {
    if a == b { 1 } else { 0 }
}

/// Assert that a Field value fits in 32 bits (i.e., 0 <= value < 2^32).
/// This proves the value is non-negative and bounded, used for >= comparisons.
fn assert_fits_in_32_bits(value: Field) {
    // Decompose value into 32 bits
    let mut acc: Field = 0;
    let bits: [u1; 32] = value.to_be_bits();
    for i in 0..32 {
        acc = acc * 2 + bits[i] as Field;
    }
    assert(acc == value, "value does not fit in 32 bits");
}

#[test]
fn test_level_2_badge() {
    // Player has 150 XP, claiming level_2 badge (type=1, threshold=100)
    let player_id: Field = 42;
    let badge_type: Field = 1;
    let badge_threshold: Field = 100;

    let total_xp: Field = 150;
    let total_trades: Field = 8;
    let win_streak: Field = 3;
    let longest_hold_ms: Field = 120000;
    let near_liq_closes: Field = 1;
    let total_sessions: Field = 2;
    let profitable_sessions: Field = 1;
    let verified_sessions: Field = 0;
    let pattern_correct: Field = 0;
    let pattern_streak: Field = 0;
    let prediction_correct: Field = 0;
    let credibility_score: Field = 0;

    // Compute attestation hash (12 stats)
    let mut running: Field = 0;
    running = running * 997 + total_xp;
    running = running * 997 + total_trades;
    running = running * 997 + win_streak;
    running = running * 997 + longest_hold_ms;
    running = running * 997 + near_liq_closes;
    running = running * 997 + total_sessions;
    running = running * 997 + profitable_sessions;
    running = running * 997 + verified_sessions;
    running = running * 997 + pattern_correct;
    running = running * 997 + pattern_streak;
    running = running * 997 + prediction_correct;
    running = running * 997 + credibility_score;
    let attestation_hash = running;

    main(
        player_id,
        badge_type,
        badge_threshold,
        attestation_hash,
        total_xp,
        total_trades,
        win_streak,
        longest_hold_ms,
        near_liq_closes,
        total_sessions,
        profitable_sessions,
        verified_sessions,
        pattern_correct,
        pattern_streak,
        prediction_correct,
        credibility_score,
    );
}

#[test]
fn test_first_blood_badge() {
    // Player completed 1 trade, claiming first_blood badge (type=10, threshold=1)
    let player_id: Field = 7;
    let badge_type: Field = 10;
    let badge_threshold: Field = 1;

    let total_xp: Field = 30;
    let total_trades: Field = 1;
    let win_streak: Field = 1;
    let longest_hold_ms: Field = 5000;
    let near_liq_closes: Field = 0;
    let total_sessions: Field = 1;
    let profitable_sessions: Field = 1;
    let verified_sessions: Field = 0;
    let pattern_correct: Field = 0;
    let pattern_streak: Field = 0;
    let prediction_correct: Field = 0;
    let credibility_score: Field = 0;

    let mut running: Field = 0;
    running = running * 997 + total_xp;
    running = running * 997 + total_trades;
    running = running * 997 + win_streak;
    running = running * 997 + longest_hold_ms;
    running = running * 997 + near_liq_closes;
    running = running * 997 + total_sessions;
    running = running * 997 + profitable_sessions;
    running = running * 997 + verified_sessions;
    running = running * 997 + pattern_correct;
    running = running * 997 + pattern_streak;
    running = running * 997 + prediction_correct;
    running = running * 997 + credibility_score;
    let attestation_hash = running;

    main(
        player_id,
        badge_type,
        badge_threshold,
        attestation_hash,
        total_xp,
        total_trades,
        win_streak,
        longest_hold_ms,
        near_liq_closes,
        total_sessions,
        profitable_sessions,
        verified_sessions,
        pattern_correct,
        pattern_streak,
        prediction_correct,
        credibility_score,
    );
}

#[test]
fn test_diamond_hands_badge() {
    // Player held for 10 minutes, claiming diamond_hands (type=12, threshold=600000)
    let player_id: Field = 99;
    let badge_type: Field = 12;
    let badge_threshold: Field = 600000;

    let total_xp: Field = 500;
    let total_trades: Field = 20;
    let win_streak: Field = 2;
    let longest_hold_ms: Field = 750000;
    let near_liq_closes: Field = 0;
    let total_sessions: Field = 5;
    let profitable_sessions: Field = 3;
    let verified_sessions: Field = 1;
    let pattern_correct: Field = 0;
    let pattern_streak: Field = 0;
    let prediction_correct: Field = 0;
    let credibility_score: Field = 0;

    let mut running: Field = 0;
    running = running * 997 + total_xp;
    running = running * 997 + total_trades;
    running = running * 997 + win_streak;
    running = running * 997 + longest_hold_ms;
    running = running * 997 + near_liq_closes;
    running = running * 997 + total_sessions;
    running = running * 997 + profitable_sessions;
    running = running * 997 + verified_sessions;
    running = running * 997 + pattern_correct;
    running = running * 997 + pattern_streak;
    running = running * 997 + prediction_correct;
    running = running * 997 + credibility_score;
    let attestation_hash = running;

    main(
        player_id,
        badge_type,
        badge_threshold,
        attestation_hash,
        total_xp,
        total_trades,
        win_streak,
        longest_hold_ms,
        near_liq_closes,
        total_sessions,
        profitable_sessions,
        verified_sessions,
        pattern_correct,
        pattern_streak,
        prediction_correct,
        credibility_score,
    );
}

#[test]
fn test_level_1_badge() {
    // Level 1 (Observer) has threshold=0, anyone qualifies
    let player_id: Field = 1;
    let badge_type: Field = 0;
    let badge_threshold: Field = 0;

    let total_xp: Field = 0;
    let total_trades: Field = 0;
    let win_streak: Field = 0;
    let longest_hold_ms: Field = 0;
    let near_liq_closes: Field = 0;
    let total_sessions: Field = 0;
    let profitable_sessions: Field = 0;
    let verified_sessions: Field = 0;
    let pattern_correct: Field = 0;
    let pattern_streak: Field = 0;
    let prediction_correct: Field = 0;
    let credibility_score: Field = 0;

    // All zeros -> attestation_hash = 0
    let attestation_hash: Field = 0;

    main(
        player_id,
        badge_type,
        badge_threshold,
        attestation_hash,
        total_xp,
        total_trades,
        win_streak,
        longest_hold_ms,
        near_liq_closes,
        total_sessions,
        profitable_sessions,
        verified_sessions,
        pattern_correct,
        pattern_streak,
        prediction_correct,
        credibility_score,
    );
}

#[test]
fn test_pattern_novice_badge() {
    // Player identified 15 patterns correctly, claiming pattern_novice (type=20, threshold=10)
    let player_id: Field = 55;
    let badge_type: Field = 20;
    let badge_threshold: Field = 10;

    let total_xp: Field = 200;
    let total_trades: Field = 5;
    let win_streak: Field = 2;
    let longest_hold_ms: Field = 30000;
    let near_liq_closes: Field = 0;
    let total_sessions: Field = 1;
    let profitable_sessions: Field = 1;
    let verified_sessions: Field = 0;
    let pattern_correct: Field = 15;
    let pattern_streak: Field = 8;
    let prediction_correct: Field = 3;
    let credibility_score: Field = 60;

    let mut running: Field = 0;
    running = running * 997 + total_xp;
    running = running * 997 + total_trades;
    running = running * 997 + win_streak;
    running = running * 997 + longest_hold_ms;
    running = running * 997 + near_liq_closes;
    running = running * 997 + total_sessions;
    running = running * 997 + profitable_sessions;
    running = running * 997 + verified_sessions;
    running = running * 997 + pattern_correct;
    running = running * 997 + pattern_streak;
    running = running * 997 + prediction_correct;
    running = running * 997 + credibility_score;
    let attestation_hash = running;

    main(
        player_id,
        badge_type,
        badge_threshold,
        attestation_hash,
        total_xp,
        total_trades,
        win_streak,
        longest_hold_ms,
        near_liq_closes,
        total_sessions,
        profitable_sessions,
        verified_sessions,
        pattern_correct,
        pattern_streak,
        prediction_correct,
        credibility_score,
    );
}

#[test]
fn test_all_rounder_badge() {
    // Player has 15 trades, 12 patterns, 11 predictions - eligible for all_rounder (type=24, threshold=10)
    let player_id: Field = 100;
    let badge_type: Field = 24;
    let badge_threshold: Field = 10;

    let total_xp: Field = 800;
    let total_trades: Field = 15;
    let win_streak: Field = 3;
    let longest_hold_ms: Field = 300000;
    let near_liq_closes: Field = 1;
    let total_sessions: Field = 4;
    let profitable_sessions: Field = 2;
    let verified_sessions: Field = 1;
    let pattern_correct: Field = 12;
    let pattern_streak: Field = 5;
    let prediction_correct: Field = 11;
    let credibility_score: Field = 65;

    let mut running: Field = 0;
    running = running * 997 + total_xp;
    running = running * 997 + total_trades;
    running = running * 997 + win_streak;
    running = running * 997 + longest_hold_ms;
    running = running * 997 + near_liq_closes;
    running = running * 997 + total_sessions;
    running = running * 997 + profitable_sessions;
    running = running * 997 + verified_sessions;
    running = running * 997 + pattern_correct;
    running = running * 997 + pattern_streak;
    running = running * 997 + prediction_correct;
    running = running * 997 + credibility_score;
    let attestation_hash = running;

    main(
        player_id,
        badge_type,
        badge_threshold,
        attestation_hash,
        total_xp,
        total_trades,
        win_streak,
        longest_hold_ms,
        near_liq_closes,
        total_sessions,
        profitable_sessions,
        verified_sessions,
        pattern_correct,
        pattern_streak,
        prediction_correct,
        credibility_score,
    );
}
