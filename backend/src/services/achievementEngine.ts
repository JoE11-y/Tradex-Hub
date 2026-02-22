import { playerRepo } from '../db/repositories/playerRepo';
import { tradeRepo } from '../db/repositories/tradeRepo';
import { sessionRepo } from '../db/repositories/sessionRepo';
import { playerService } from './playerService';
import { ACHIEVEMENTS } from '../domain/types';
import type { AchievementDef } from '../domain/types';
import { sendToPlayer } from '../ws/broadcaster';

export const achievementEngine = {
  checkAfterTrade(playerId: number, sessionId: number): string[] {
    const player = playerRepo.findById(playerId);
    if (!player) return [];

    const existing = playerRepo.getAchievements(playerId);
    const trades = tradeRepo.findBySession(sessionId);
    const totalTrades = player.total_trades;
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);

    const unlocked: string[] = [];

    for (const ach of ACHIEVEMENTS) {
      if (existing.includes(ach.id)) continue;

      let shouldUnlock = false;

      switch (ach.id) {
        case 'first_blood':
          shouldUnlock = totalTrades >= 1;
          break;
        case 'winning_streak':
          shouldUnlock = player.win_streak >= 5;
          break;
        case 'diamond_hands':
          shouldUnlock = player.longest_hold_ms >= 600_000;
          break;
        case 'liquidation_survivor':
          shouldUnlock = player.near_liq_closes >= 3;
          break;
        case 'ten_trades':
          shouldUnlock = totalTrades >= 10;
          break;
        case 'profitable_session':
          shouldUnlock = totalPnl > 0 && trades.length >= 5;
          break;
        case 'fifty_trades':
          shouldUnlock = totalTrades >= 50;
          break;
        case 'century_trader':
          shouldUnlock = totalTrades >= 100;
          break;
        case 'iron_streak':
          shouldUnlock = player.win_streak >= 10;
          break;
        // Education module achievements
        case 'pattern_novice':
          shouldUnlock = (player.pattern_correct || 0) >= 10;
          break;
        case 'pattern_master':
          shouldUnlock = (player.pattern_best_streak || 0) >= 25;
          break;
        case 'prediction_novice':
          shouldUnlock = (player.prediction_correct || 0) >= 10;
          break;
        case 'prediction_master':
          shouldUnlock = (player.credibility_score || 0) >= 80 && (player.prediction_total || 0) >= 20;
          break;
        case 'all_rounder':
          shouldUnlock = (player.pattern_total || 0) >= 10 && (player.prediction_total || 0) >= 10 && totalTrades >= 10;
          break;
        // Risk management achievements
        case 'risk_manager':
          shouldUnlock = ((player as unknown as Record<string, unknown>).consecutive_sl_trades as number || 0) >= 5;
          break;
        case 'good_rr':
          shouldUnlock = ((player as unknown as Record<string, unknown>).good_rr_trades as number || 0) >= 3;
          break;
        case 'drawdown_survivor': {
          // Check if player recovered from 4%+ drawdown and ended session profitable
          const session = sessionRepo.findById(sessionId);
          if (session && trades.length >= 5) {
            const sessionPnl = trades.reduce((s, t) => s + t.pnl, 0);
            // Compute max drawdown from trade sequence
            let peak = session.starting_balance;
            let runBal = session.starting_balance;
            let maxDd = 0;
            for (const t of trades) {
              runBal += t.pnl;
              if (runBal > peak) peak = runBal;
              const dd = peak > 0 ? (peak - runBal) / peak : 0;
              if (dd > maxDd) maxDd = dd;
            }
            shouldUnlock = maxDd >= 0.04 && sessionPnl > 0;
          }
          break;
        }
        // badge_collector is checked separately after badge mint
      }

      if (shouldUnlock) {
        const added = playerRepo.addAchievement(playerId, ach.id, ach.xpReward);
        if (added) {
          unlocked.push(ach.id);
          playerService.awardXp(playerId, ach.xpReward, `Achievement: ${ach.name}`);
          sendToPlayer(playerId, {
            type: 'achievement_unlocked',
            achievement: { ...ach, unlocked_at: Date.now() },
          });
        }
      }
    }

    return unlocked;
  },

  checkAfterEducation(playerId: number): string[] {
    const player = playerRepo.findById(playerId);
    if (!player) return [];

    const existing = playerRepo.getAchievements(playerId);
    const unlocked: string[] = [];
    const educationAchievements = ['pattern_novice', 'pattern_master', 'prediction_novice', 'prediction_master', 'all_rounder'];

    for (const ach of ACHIEVEMENTS) {
      if (!educationAchievements.includes(ach.id)) continue;
      if (existing.includes(ach.id)) continue;

      let shouldUnlock = false;
      switch (ach.id) {
        case 'pattern_novice':
          shouldUnlock = (player.pattern_correct || 0) >= 10;
          break;
        case 'pattern_master':
          shouldUnlock = (player.pattern_best_streak || 0) >= 25;
          break;
        case 'prediction_novice':
          shouldUnlock = (player.prediction_correct || 0) >= 10;
          break;
        case 'prediction_master':
          shouldUnlock = (player.credibility_score || 0) >= 80 && (player.prediction_total || 0) >= 20;
          break;
        case 'all_rounder':
          shouldUnlock = (player.pattern_total || 0) >= 10 && (player.prediction_total || 0) >= 10 && player.total_trades >= 10;
          break;
      }

      if (shouldUnlock) {
        const added = playerRepo.addAchievement(playerId, ach.id, ach.xpReward);
        if (added) {
          unlocked.push(ach.id);
          playerService.awardXp(playerId, ach.xpReward, `Achievement: ${ach.name}`);
          sendToPlayer(playerId, {
            type: 'achievement_unlocked',
            achievement: { ...ach, unlocked_at: Date.now() },
          });
        }
      }
    }

    return unlocked;
  },

  checkBadgeCollector(playerId: number): boolean {
    const existing = playerRepo.getAchievements(playerId);
    if (existing.includes('badge_collector')) return false;

    const ach = ACHIEVEMENTS.find((a) => a.id === 'badge_collector')!;
    const added = playerRepo.addAchievement(playerId, ach.id, ach.xpReward);
    if (added) {
      playerService.awardXp(playerId, ach.xpReward, `Achievement: ${ach.name}`);
      sendToPlayer(playerId, {
        type: 'achievement_unlocked',
        achievement: { ...ach, unlocked_at: Date.now() },
      });
      return true;
    }
    return false;
  },
};
