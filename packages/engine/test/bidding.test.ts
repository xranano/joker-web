import { describe, expect, it } from 'vitest';
import { applyAction, bannedDealerBid, getLegalMoves, legalBids } from '../src';
import { newGame } from './helpers';

describe('bidding', () => {
  it('starts after the dealer and goes clockwise', () => {
    let s = newGame('standard'); // dealer 3
    expect(s.turn).toBe(0);
    s = applyAction(s, { type: 'bid', playerId: 'a', bid: 0 });
    expect(s.turn).toBe(1);
    expect(() => applyAction(s, { type: 'bid', playerId: 'a', bid: 0 })).toThrow(/turn/);
  });

  it('allows 0..handSize for non-dealers', () => {
    expect(legalBids([null, null, null, null], 0, 3, 5)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('dealer may not make the bids add up to the hand size', () => {
    expect(bannedDealerBid([1, 2, 1, null], 3, 5)).toBe(1);
    expect(legalBids([1, 2, 1, null], 3, 3, 5)).toEqual([0, 2, 3, 4, 5]);
    // others already over the hand size: nothing is banned
    expect(bannedDealerBid([3, 2, 2, null], 3, 5)).toBeNull();
    expect(legalBids([3, 2, 2, null], 3, 3, 5)).toHaveLength(6);
    // others bid 0: dealer cannot bid the full hand
    expect(legalBids([0, 0, 0, null], 3, 3, 2)).toEqual([0, 1]);
  });

  it('enforces the dealer restriction through applyAction', () => {
    let s = newGame('standard'); // hand size 1, dealer 3
    s = applyAction(s, { type: 'bid', playerId: 'a', bid: 0 });
    s = applyAction(s, { type: 'bid', playerId: 'b', bid: 0 });
    s = applyAction(s, { type: 'bid', playerId: 'c', bid: 0 });
    expect(getLegalMoves(s, 'd').map((m) => (m as { bid: number }).bid)).toEqual([0]);
    expect(() => applyAction(s, { type: 'bid', playerId: 'd', bid: 1 })).toThrow();
    s = applyAction(s, { type: 'bid', playerId: 'd', bid: 0 });
    expect(s.phase).toBe('playing');
    expect(s.turn).toBe(0); // player after the dealer leads
  });

  it('rejects out-of-range bids', () => {
    const s = newGame('standard');
    expect(() => applyAction(s, { type: 'bid', playerId: 'a', bid: 2 })).toThrow();
    expect(() => applyAction(s, { type: 'bid', playerId: 'a', bid: -1 })).toThrow();
  });
});
