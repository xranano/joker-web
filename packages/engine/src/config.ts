import type { Suit } from './types';

export const SUITS: readonly Suit[] = ['S', 'C', 'H', 'D'];

/**
 * Every tunable number of the game lives here.
 */
export const RULES = {
  players: 4,
  ranks: [6, 7, 8, 9, 10, 11, 12, 13, 14],
  /** removed from the 36-card deck and replaced by Jokers */
  removedCards: ['6S', '6C'],
  jokerCount: 2,
  /** hands of this size use "chooser picks trump after seeing N cards" */
  chooseTrumpAtHandSize: 9,
  trumpPreviewCards: 3,
  scoring: {
    /** exact bid: exactPerTrick × bid + exactBase  (bid 0 made = exactBase) */
    exactPerTrick: 50,
    exactBase: 50,
    /** bid = hand size and made: fullBidPerTrick × tricks */
    fullBidPerTrick: 100,
    /** took more than bid: overPerTrick × tricks */
    overPerTrick: 10,
    /** took fewer than bid (but at least 1): underPerTrick × tricks */
    underPerTrick: 10,
  },
  pulkaBonus: {
    /** off by default; when on, a player who makes every bid in a pulka
     *  gets their best single-hand score of that pulka added again */
    enabled: false,
  },
  khishtiOptions: [-200, -500, -1000],
  defaultKhishti: -200,
  turnTimerOptions: [0, 30, 60],
  defaultTurnTimer: 0,
  timing: {
    botDelayMs: 600,
    /** extra pause after a trick completes before a bot acts */
    trickPauseMs: 1200,
    /** a disconnected player's turns are played by a bot after this */
    disconnectGraceMs: 30_000,
    /** rooms with nobody connected are deleted after this */
    emptyRoomTtlMs: 30 * 60_000,
  },
  maxNameLength: 16,
  roomCodeLength: 6,
} as const;

export interface ModeDef {
  id: string;
  /** each pulka is a list of hand sizes */
  pulkas: number[][];
}

/** Add a mode here; the engine needs no change. */
export const MODES: Record<string, ModeDef> = {
  standard: {
    id: 'standard',
    pulkas: [
      [1, 2, 3, 4, 5, 6, 7, 8],
      [9, 9, 9, 9],
      [8, 7, 6, 5, 4, 3, 2, 1],
      [9, 9, 9, 9],
    ],
  },
  nines: {
    id: 'nines',
    pulkas: [
      [9, 9, 9, 9],
      [9, 9, 9, 9],
      [9, 9, 9, 9],
      [9, 9, 9, 9],
    ],
  },
};

export const DEFAULT_SETTINGS = {
  mode: 'standard',
  khishti: RULES.defaultKhishti,
  turnTimer: RULES.defaultTurnTimer,
  pulkaBonus: RULES.pulkaBonus.enabled,
};
