import { z } from 'zod';
import { CONFIG, EXPIRY_DURATIONS } from '../config';
import { AppError, ErrorCode } from '../domain/errors';

// ── Reusable field schemas ──

export const assetSchema = z.enum(CONFIG.VALID_ASSETS as unknown as [string, ...string[]]);
export const sideSchema = z.enum(['long', 'short']);
const validLeverages = CONFIG.VALID_LEVERAGES as readonly number[];
export const leverageSchema = z.number().refine(
  (v) => validLeverages.includes(v),
  { message: `Must be one of: ${CONFIG.VALID_LEVERAGES.join(', ')}` },
);
export const optionTypeSchema = z.enum(['call', 'put']);
export const expirySchema = z.enum(Object.keys(EXPIRY_DURATIONS) as [string, ...string[]]);
export const leaderboardPeriodSchema = z.enum(['weekly', 'all_time']);

// ── Route schemas ──

export const tradeOpenSchema = z.object({
  asset: assetSchema,
  side: sideSchema,
  leverage: leverageSchema,
  margin: z.number().positive(),
  stop_loss: z.number().positive().optional(),
  take_profit: z.number().positive().optional(),
});

export const tradeCloseSchema = z.object({
  position_id: z.string().min(1),
});

export const optionOpenSchema = z.object({
  asset: assetSchema,
  option_type: optionTypeSchema,
  strike_price: z.number().positive(),
  expiry: expirySchema,
  premium: z.number().positive(),
});

export const walletSchema = z.object({
  wallet_address: z.string().min(1),
});

export const verifySchema = z.object({
  wallet_address: z.string().min(1),
  signature: z.string().min(1),
});

export const displayNameSchema = z.object({
  display_name: z.string().min(1).max(30),
});

export const sessionIdSchema = z.object({
  session_id: z.number().int().positive(),
});

export const batchIdSchema = z.object({
  batch_id: z.number().int().positive(),
});

export const badgeIdSchema = z.object({
  badge_id: z.string().min(1),
});

// ── Education module schemas ──

export const patternAnswerSchema = z.object({
  challenge_id: z.number().int().positive(),
  answer: z.string().min(1),
  time_ms: z.number().int().nonnegative(),
});

export const predictionChallengeSchema = z.object({
  asset: assetSchema.optional(),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h']).optional(),
});

export const predictionAnswerSchema = z.object({
  challenge_id: z.number().int().positive(),
  direction: z.enum(['up', 'down', 'sideways']),
  magnitude: z.enum(['small', 'medium', 'large', 'huge']).optional(),
  bet_amount: z.number().positive().optional(),
});

// ── Parse helper that throws AppError ──

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue.path.join('.') || 'input';
    throw new AppError(ErrorCode.VALIDATION_ERROR, `${path}: ${firstIssue.message}`);
  }
  return result.data;
}
