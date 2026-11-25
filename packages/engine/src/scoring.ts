import { RULES } from './config';

export interface HandScore {
  points: number;
  khishti: boolean;
}

/**
 * - exact bid → 50 × bid + 50 (bid 0 made = 50)
 * - bid = hand size and made → 100 × tricks
 * - over the bid → 10 × tricks
 * - bid ≥ 1 and took 0 → khishti
 * - under the bid (took ≥ 1) → 10 × tricks
 */
export function scoreHand(
  bid: number,
  tricks: number,
  handSize: number,
  khishti: number,
  scoring: typeof RULES.scoring = RULES.scoring,
): HandScore {
  if (bid === tricks) {
    if (bid === handSize) return { points: scoring.fullBidPerTrick * tricks, khishti: false };
    return { points: scoring.exactPerTrick * bid + scoring.exactBase, khishti: false };
  }
  if (bid >= 1 && tricks === 0) return { points: normalizeKhishti(khishti), khishti: true };
  if (tricks > bid) return { points: scoring.overPerTrick * tricks, khishti: false };
  return { points: scoring.underPerTrick * tricks, khishti: false };
}

/** Accepts 200 or -200, always returns a non-positive integer. */
export function normalizeKhishti(value: number): number {
  if (!Number.isFinite(value)) return RULES.defaultKhishti;
  return -Math.abs(Math.round(value));
}
