import { SUITS } from './config';
import type { Card, JokerChoice, Suit, Trick, TrickPlay } from './types';

export interface LedInfo {
  suit: Suit;
  /** a Joker was led HIGH: others must play their highest card of `suit` */
  highDemand: boolean;
}

export function ledInfo(trick: Pick<Trick, 'plays'>): LedInfo | null {
  const first = trick.plays[0];
  if (!first) return null;
  if (first.card.joker) {
    if (!first.joker?.suit) throw new Error('Led Joker must name a suit');
    return { suit: first.joker.suit, highDemand: first.joker.mode === 'high' };
  }
  return { suit: first.card.suit!, highDemand: false };
}

/** Cards from `hand` that may legally be played to `trick`. */
export function legalCards(hand: Card[], trick: Pick<Trick, 'plays'>, trump: Suit | null): Card[] {
  const led = ledInfo(trick);
  if (!led) return [...hand];
  const jokers = hand.filter((c) => c.joker);
  const normals = hand.filter((c) => !c.joker);
  const ofSuit = normals.filter((c) => c.suit === led.suit);
  let allowed: Card[];
  if (ofSuit.length > 0) {
    if (led.highDemand) {
      const max = Math.max(...ofSuit.map((c) => c.rank));
      allowed = ofSuit.filter((c) => c.rank === max);
    } else {
      allowed = ofSuit;
    }
  } else if (trump && normals.some((c) => c.suit === trump)) {
    allowed = normals.filter((c) => c.suit === trump);
  } else {
    allowed = normals;
  }
  return [...allowed, ...jokers];
}

/** All Joker choices available for a Joker played to this trick. */
export function jokerOptions(isLead: boolean): JokerChoice[] {
  if (!isLead) return [{ mode: 'high' }, { mode: 'low' }];
  const out: JokerChoice[] = [];
  for (const suit of SUITS) {
    out.push({ mode: 'high', suit }, { mode: 'low', suit });
  }
  return out;
}

/**
 * Seat currently winning the (possibly partial) trick.
 *
 * - A non-led Joker played HIGH beats everything; a later HIGH Joker beats an earlier one.
 * - A Joker played LOW (not led) never wins.
 * - A Joker led HIGH wins unless a HIGH Joker follows, or the named suit is not trump
 *   and somebody trumped (then the highest trump wins).
 * - A Joker led LOW counts as the lowest card of the named suit.
 */
export function trickWinner(plays: TrickPlay[], trump: Suit | null): number {
  if (plays.length === 0) throw new Error('Empty trick');
  const [first, ...rest] = plays;

  const laterHighJokers = rest.filter((p) => p.card.joker && p.joker?.mode === 'high');
  if (laterHighJokers.length > 0) return laterHighJokers[laterHighJokers.length - 1].seat;

  const led = ledInfo({ plays })!;
  const trumpsPlayed = plays.filter((p) => !p.card.joker && trump !== null && p.card.suit === trump);
  const highest = (ps: TrickPlay[]) => ps.reduce((best, p) => (p.card.rank > best.card.rank ? p : best));

  if (first.card.joker && led.highDemand) {
    if (led.suit !== trump && trumpsPlayed.length > 0) return highest(trumpsPlayed).seat;
    return first.seat;
  }

  if (trumpsPlayed.length > 0) return highest(trumpsPlayed).seat;

  // Joker led LOW counts as rank 0 of the named suit; non-led LOW jokers are ignored.
  const candidates = plays.filter((p, i) => (i === 0 && p.card.joker) || (!p.card.joker && p.card.suit === led.suit));
  return highest(candidates).seat;
}

export function bannedDealerBid(bids: (number | null)[], dealer: number, handSize: number): number | null {
  const sum = bids.reduce<number>((acc, b, seat) => (seat === dealer || b === null ? acc : acc + b), 0);
  const banned = handSize - sum;
  return banned >= 0 && banned <= handSize ? banned : null;
}

export function legalBids(bids: (number | null)[], seat: number, dealer: number, handSize: number): number[] {
  const banned = seat === dealer ? bannedDealerBid(bids, dealer, handSize) : null;
  const out: number[] = [];
  for (let b = 0; b <= handSize; b++) if (b !== banned) out.push(b);
  return out;
}
