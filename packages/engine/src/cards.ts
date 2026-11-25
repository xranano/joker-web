import { RULES, SUITS } from './config';
import type { Card, Suit } from './types';

const RANK_LABEL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank);
}

export function cardId(rank: number, suit: Suit): string {
  return `${rankLabel(rank)}${suit}`;
}

/** 36 cards: 6–A in 4 suits, with 6♠ and 6♣ replaced by 2 Jokers. */
export function createDeck(): Card[] {
  const removed = new Set<string>(RULES.removedCards);
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RULES.ranks) {
      const id = cardId(rank, suit);
      if (!removed.has(id)) deck.push({ id, suit, rank, joker: false });
    }
  }
  for (let i = 1; i <= RULES.jokerCount; i++) {
    deck.push({ id: `X${i}`, suit: null, rank: 0, joker: true });
  }
  return deck;
}

/** Jokers first, then suits in SUITS order, high to low. */
export function sortHand(hand: Card[], trump: Suit | null = null): Card[] {
  const suitOrder = (s: Suit | null) => {
    if (s === null) return -1;
    if (s === trump) return 0;
    return 1 + SUITS.indexOf(s);
  };
  return [...hand].sort((a, b) => suitOrder(a.suit) - suitOrder(b.suit) || b.rank - a.rank || a.id.localeCompare(b.id));
}

/** mulberry32 – returns [value in 0..1, next state] */
export function nextRandom(state: number): [number, number] {
  const t = (state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

export function shuffle<T>(items: T[], rng: number): [T[], number] {
  const out = [...items];
  let state = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [r, next] = nextRandom(state);
    state = next;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, state];
}
