import { describe, expect, it } from 'vitest';
import { buildSchedule, createDeck, getLegalMoves, applyAction } from '../src';
import { newGame } from './helpers';

describe('deck', () => {
  it('has 36 cards: 34 normal + 2 jokers, no 6♠/6♣', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(36);
    expect(deck.filter((c) => c.joker)).toHaveLength(2);
    const ids = deck.map((c) => c.id);
    expect(new Set(ids).size).toBe(36);
    expect(ids).not.toContain('6S');
    expect(ids).not.toContain('6C');
    expect(ids).toContain('6H');
    expect(ids).toContain('6D');
    for (const s of ['S', 'C']) expect(deck.filter((c) => c.suit === s)).toHaveLength(8);
    for (const s of ['H', 'D']) expect(deck.filter((c) => c.suit === s)).toHaveLength(9);
  });
});

describe('schedule & deal sizes', () => {
  it('standard mode: 24 hands 1..8, 9×4, 8..1, 9×4', () => {
    const sizes = buildSchedule('standard').map((h) => h.size);
    expect(sizes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 9, 8, 7, 6, 5, 4, 3, 2, 1, 9, 9, 9, 9]);
    expect(buildSchedule('standard').map((h) => h.pulka)).toEqual([
      ...Array(8).fill(0), ...Array(4).fill(1), ...Array(8).fill(2), ...Array(4).fill(3),
    ]);
  });

  it('nines mode: 16 hands of 9 in 4 pulkas', () => {
    const sched = buildSchedule('nines');
    expect(sched).toHaveLength(16);
    expect(sched.every((h) => h.size === 9)).toBe(true);
    expect(new Set(sched.map((h) => h.pulka))).toEqual(new Set([0, 1, 2, 3]));
  });

  it('deals the right number of cards for each standard hand size', () => {
    let s = newGame('standard');
    const seen: number[] = [];
    // play through the whole game with first legal moves
    while (s.phase !== 'gameOver') {
      if (s.history.length === seen.length) {
        seen.push(s.handSize);
        expect(s.hands.every((h) => h.length === s.handSize)).toBe(true);
        const used = s.handSize * 4 + s.deck.length + (s.trumpCard ? 1 : 0);
        expect(used).toBe(36);
      }
      const pid = s.players[s.turn].id;
      s = applyAction(s, getLegalMoves(s, pid)[0]);
    }
    expect(seen).toEqual(buildSchedule('standard').map((h) => h.size));
    expect(s.history).toHaveLength(24);
  });

  it('deals 9 cards each in nines mode and plays 16 hands', () => {
    let s = newGame('nines');
    expect(s.hands.every((h) => h.length === 9)).toBe(true);
    expect(s.deck).toHaveLength(0);
    while (s.phase !== 'gameOver') s = applyAction(s, getLegalMoves(s, s.players[s.turn].id)[0]);
    expect(s.history).toHaveLength(16);
  });

  it('rotates the dealer clockwise each hand', () => {
    let s = newGame('standard');
    const dealers = [s.dealer];
    while (s.history.length < 5) {
      s = applyAction(s, getLegalMoves(s, s.players[s.turn].id)[0]);
      if (dealers.length === s.history.length) dealers.push(s.dealer);
    }
    expect(dealers.slice(0, 5)).toEqual([3, 0, 1, 2, 3]);
  });
});
