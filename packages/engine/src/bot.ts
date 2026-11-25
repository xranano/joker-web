import { RULES, SUITS } from './config';
import { getLegalMoves } from './game';
import { trickWinner } from './rules';
import type { Action, Card, GameState, PlayerView, Suit, TrickPlay } from './types';

type Source = GameState | PlayerView;

function myHand(state: Source, seat: number): Card[] {
  if ('hands' in state) {
    const h = state.hands[seat];
    return state.phase === 'trump' ? h.slice(0, RULES.trumpPreviewCards) : h;
  }
  return state.hand;
}

/** Rough trick estimate: Jokers, aces, kings and trump length. */
export function estimateTricks(hand: Card[], trump: Suit | null): number {
  let est = 0;
  let trumpCount = 0;
  for (const c of hand) {
    if (c.joker) est += 1;
    else if (c.rank === 14) est += 1;
    else if (c.rank === 13) est += c.suit === trump ? 0.75 : 0.4;
    if (!c.joker && c.suit === trump) trumpCount++;
  }
  if (trump && trumpCount > 2) est += (trumpCount - 2) * 0.6;
  return Math.min(hand.length, Math.round(est));
}

function cardStrength(card: Card, trump: Suit | null): number {
  if (card.joker) return 100;
  return card.rank + (card.suit === trump ? 20 : 0);
}

/**
 * Easy bot. Picks one of getLegalMoves(state, playerId); also used to auto-play on timeout.
 * Works on a full GameState or on the bot's own PlayerView.
 */
export function chooseBotAction(state: Source, playerId: string): Action {
  const legal = getLegalMoves(state, playerId);
  if (legal.length === 0) throw new Error('Bot has no legal move');
  const seat = state.players.findIndex((p) => p.id === playerId);
  const hand = myHand(state, seat);

  if (state.phase === 'trump') {
    const score: Record<string, number> = {};
    for (const c of hand) if (!c.joker) score[c.suit!] = (score[c.suit!] ?? 0) + 10 + c.rank;
    const best = SUITS.reduce<Suit | null>((b, s) => ((score[s] ?? 0) > (b ? score[b] ?? 0 : 0) ? s : b), null);
    const pick = best && (score[best] ?? 0) >= 2 * 10 ? best : null;
    return legal.find((a) => a.type === 'chooseTrump' && a.suit === pick) ?? legal[0];
  }

  if (state.phase === 'bidding') {
    const est = estimateTricks(hand, state.trump);
    const bids = legal.map((a) => (a as Extract<Action, { type: 'bid' }>).bid);
    const nearest = bids.reduce((b, x) => (Math.abs(x - est) < Math.abs(b - est) ? x : b), bids[0]);
    return legal.find((a) => a.type === 'bid' && a.bid === nearest)!;
  }

  // playing
  const plays = legal as Extract<Action, { type: 'play' }>[];
  const bid = state.bids[seat] ?? 0;
  const needMore = state.tricks[seat] < bid;
  const trick = state.trick.plays;
  const cardById = new Map(hand.map((c) => [c.id, c]));
  const trump = state.trump;
  const strength = (a: (typeof plays)[number]) => cardStrength(cardById.get(a.cardId)!, trump);
  const normals = plays.filter((a) => !a.joker);
  const byStrength = (xs: typeof plays) => [...xs].sort((a, b) => strength(a) - strength(b));

  if (trick.length === 0) {
    if (needMore) {
      const ace = byStrength(normals).reverse().find((a) => cardById.get(a.cardId)!.rank === 14);
      if (ace) return ace;
      const jokerHigh = plays.find((a) => a.joker?.mode === 'high' && a.joker.suit === (trump ?? 'H'));
      if (jokerHigh) return jokerHigh;
      return byStrength(normals)[0] ?? plays[0];
    }
    // lose: lead the weakest card
    return byStrength(normals)[0] ?? plays.find((a) => a.joker?.mode === 'low') ?? plays[0];
  }

  const wouldWin = (a: (typeof plays)[number]) => {
    const play: TrickPlay = { seat, card: cardById.get(a.cardId)!, joker: a.joker };
    return trickWinner([...trick, play], trump) === seat;
  };

  if (needMore) {
    const cheapestWinner = byStrength(normals).find(wouldWin);
    if (cheapestWinner) return cheapestWinner;
    const jokerHigh = plays.find((a) => a.joker?.mode === 'high');
    if (jokerHigh) return jokerHigh;
    return byStrength(normals)[0] ?? plays[0];
  }

  // bid reached: dump the highest card that still loses, Joker LOW if nothing else loses
  const losers = byStrength(normals).filter((a) => !wouldWin(a));
  if (losers.length > 0) return losers[losers.length - 1];
  const jokerLow = plays.find((a) => a.joker?.mode === 'low');
  if (jokerLow) return jokerLow;
  return byStrength(normals)[0] ?? plays[0];
}
