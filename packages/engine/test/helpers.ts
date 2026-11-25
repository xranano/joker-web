import { createGame, type Card, type GameState, type Suit, type TrickPlay } from '../src';

export const PLAYERS = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase() }));

const RANKS: Record<string, number> = { J: 11, Q: 12, K: 13, A: 14 };

/** "AS" → ace of spades, "10H", "X1" → joker */
export function c(id: string): Card {
  if (id.startsWith('X')) return { id, suit: null, rank: 0, joker: true };
  const suit = id.slice(-1) as Suit;
  const r = id.slice(0, -1);
  return { id, suit, rank: RANKS[r] ?? Number(r), joker: false };
}

export function cards(ids: string): Card[] {
  return ids.split(/\s+/).filter(Boolean).map(c);
}

export function play(seat: number, id: string, joker?: TrickPlay['joker']): TrickPlay {
  return joker ? { seat, card: c(id), joker } : { seat, card: c(id) };
}

export function newGame(mode = 'standard', extra: Partial<Parameters<typeof createGame>[0]['settings']> = {}, seed = 42) {
  return createGame({ players: PLAYERS, settings: { mode, khishti: -200, turnTimer: 0, ...extra }, seed, firstDealer: 3 });
}

/** A state in the playing phase with the given hands (dealer 3, so seat 0 leads). */
export function playingState(hands: string[], trump: Suit | null, bids = [1, 1, 1, 1]): GameState {
  const s = newGame();
  const parsed = hands.map(cards);
  s.handSize = parsed[0].length;
  s.hands = parsed;
  s.deck = [];
  s.trump = trump;
  s.trumpCard = null;
  s.bids = bids;
  s.tricks = [0, 0, 0, 0];
  s.phase = 'playing';
  s.turn = 0;
  s.trick = { leader: 0, plays: [] };
  return s;
}
