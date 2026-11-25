import { describe, expect, it } from 'vitest';
import { applyAction, getLegalMoves, getPlayerView, getRankings } from '../src';
import { newGame } from './helpers';

describe('getPlayerView', () => {
  it('hides other hands, the deck and the RNG state', () => {
    let s = newGame('standard');
    while (s.handSize < 5) s = applyAction(s, getLegalMoves(s, s.players[s.turn].id)[0]);
    const v = getPlayerView(s, 'b');
    expect(v.seat).toBe(1);
    expect(v.hand).toEqual(s.hands[1]);
    expect(v.handCounts).toEqual([5, 5, 5, 5]);
    expect(v.deckCount).toBe(s.deck.length);
    const json = JSON.stringify(v);
    expect(json).not.toContain('"hands"');
    expect(json).not.toContain('"deck"');
    expect(json).not.toContain('"rng"');
    // stronger: no foreign card id appears anywhere except the visible trump card / history tricks
    const visible = new Set([...v.hand.map((c) => c.id), s.trumpCard?.id, ...(s.lastTrick?.plays.map((p) => p.card.id) ?? [])]);
    const foreign = [0, 2, 3].flatMap((seat) => s.hands[seat].map((c) => c.id)).filter((id) => !visible.has(id));
    for (const id of foreign) expect(json).not.toContain(`"${id}"`);
    for (const card of s.deck.filter((d) => !visible.has(d.id))) expect(json).not.toContain(`"${card.id}"`);
  });

  it('spectator (null) sees no cards', () => {
    const s = newGame();
    const v = getPlayerView(s, null);
    expect(v.seat).toBeNull();
    expect(v.hand).toEqual([]);
  });

  it('does not share references with the state', () => {
    const s = newGame();
    const v = getPlayerView(s, 'a');
    v.hand.pop();
    v.totals[0] = 999;
    expect(s.hands[0]).toHaveLength(1);
    expect(s.totals[0]).toBe(0);
  });

  it('client can compute legal moves from its own view', () => {
    let s = newGame('standard');
    for (let i = 0; i < 40; i++) {
      const pid = s.players[s.turn].id;
      const fromState = getLegalMoves(s, pid);
      const fromView = getLegalMoves(getPlayerView(s, pid), pid);
      expect(fromView).toEqual(fromState);
      s = applyAction(s, fromState[0]);
    }
  });
});

describe('applyAction purity', () => {
  it('does not mutate the input state', () => {
    const s = newGame();
    const snapshot = JSON.stringify(s);
    applyAction(s, getLegalMoves(s, s.players[s.turn].id)[0]);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe('rankings', () => {
  it('sorts by total with shared places for ties', () => {
    const r = getRankings({ players: newGame().players, totals: [100, 300, 100, -200] });
    expect(r.map((x) => [x.name, x.place])).toEqual([['B', 1], ['A', 2], ['C', 2], ['D', 4]]);
  });
});
