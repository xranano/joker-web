import { describe, expect, it } from 'vitest';
import { applyAction, getLegalMoves, legalCards, trickWinner } from '../src';
import { cards, play, playingState } from './helpers';

const ids = (cs: { id: string }[]) => cs.map((c) => c.id).sort();
const moveIds = (s: ReturnType<typeof playingState>, pid: string) =>
  [...new Set(getLegalMoves(s, pid).map((m) => (m as { cardId: string }).cardId))].sort();

describe('follow suit / must trump', () => {
  it('anything may be led', () => {
    expect(ids(legalCards(cards('AS 7H 9D X1'), { plays: [] }, 'H'))).toEqual(['7H', '9D', 'AS', 'X1']);
  });

  it('must follow suit when able (Joker always allowed)', () => {
    const trick = { plays: [play(0, '10S')] };
    expect(ids(legalCards(cards('AS 7S 9D QH X2'), trick, 'H'))).toEqual(['7S', 'AS', 'X2']);
  });

  it('void in led suit: must trump', () => {
    const trick = { plays: [play(0, '10S')] };
    expect(ids(legalCards(cards('9D QH 7H X1'), trick, 'H'))).toEqual(['7H', 'QH', 'X1']);
  });

  it('void and no trump in hand: anything', () => {
    const trick = { plays: [play(0, '10S')] };
    expect(ids(legalCards(cards('9D 8C'), trick, 'H'))).toEqual(['8C', '9D']);
  });

  it('no-trump hand: void player may play anything', () => {
    const trick = { plays: [play(0, '10S')] };
    expect(ids(legalCards(cards('9D QH'), trick, null))).toEqual(['9D', 'QH']);
  });

  it('applyAction rejects revoking', () => {
    let s = playingState(['AS 6D', '7S 9H', 'KD 8D', 'QC 8C'], 'H');
    s = applyAction(s, { type: 'play', playerId: 'a', cardId: 'AS' });
    expect(() => applyAction(s, { type: 'play', playerId: 'b', cardId: '9H' })).toThrow();
    expect(moveIds(s, 'b')).toEqual(['7S']);
    expect(() => applyAction(s, { type: 'play', playerId: 'b', cardId: 'XX' })).toThrow();
  });
});

describe('trick winner', () => {
  it('highest card of led suit wins without trumps', () => {
    expect(trickWinner([play(0, '10S'), play(1, 'AS'), play(2, 'KD'), play(3, 'JS')], 'H')).toBe(1);
  });

  it('off-suit high cards do not win', () => {
    expect(trickWinner([play(0, '7S'), play(1, 'AD'), play(2, 'AC'), play(3, '8S')], null)).toBe(3);
  });

  it('highest trump wins', () => {
    expect(trickWinner([play(0, 'AS'), play(1, '6H'), play(2, '9H'), play(3, 'KS')], 'H')).toBe(2);
  });

  it('trick winner leads the next trick and gets the trick', () => {
    let s = playingState(['7S 6D', 'AS 7D', '8S 8D', '9S 9D'], 'H');
    for (const [pid, card] of [['a', '7S'], ['b', 'AS'], ['c', '8S'], ['d', '9S']]) {
      s = applyAction(s, { type: 'play', playerId: pid, cardId: card });
    }
    expect(s.tricks).toEqual([0, 1, 0, 0]);
    expect(s.turn).toBe(1);
    expect(s.trick).toEqual({ leader: 1, plays: [] });
    expect(s.lastTrick?.winner).toBe(1);
  });
});

describe('jokers', () => {
  it('a Joker can be played at any time, even when able to follow suit', () => {
    const s = playingState(['AS 6D', 'KS X1', '8S 8D', '9S 9D'], 'H');
    const s2 = applyAction(s, { type: 'play', playerId: 'a', cardId: 'AS' });
    expect(moveIds(s2, 'b')).toEqual(['KS', 'X1']);
  });

  it('non-led Joker offers HIGH/LOW; led Joker offers suit × HIGH/LOW', () => {
    const s = playingState(['X1 6D', 'KS 7D', '8S 8D', '9S 9D'], 'H');
    expect(getLegalMoves(s, 'a').filter((m) => (m as { cardId: string }).cardId === 'X1')).toHaveLength(8);
    const s2 = playingState(['6D 7D', 'KS X1', '8S 8D', '9S 9D'], 'H');
    const after = applyAction(s2, { type: 'play', playerId: 'a', cardId: '6D' });
    expect(getLegalMoves(after, 'b').filter((m) => (m as { cardId: string }).cardId === 'X1')).toHaveLength(2);
  });

  it('a led Joker must name a suit', () => {
    const s = playingState(['X1 6D', 'KS 7D', '8S 8D', '9S 9D'], 'H');
    expect(() => applyAction(s, { type: 'play', playerId: 'a', cardId: 'X1', joker: { mode: 'high' } })).toThrow();
    expect(() => applyAction(s, { type: 'play', playerId: 'a', cardId: 'X1' })).toThrow();
  });

  it('played HIGH (not led) wins the trick, even over trumps', () => {
    expect(trickWinner([play(0, 'AS'), play(1, 'X1', { mode: 'high' }), play(2, 'AH'), play(3, 'KS')], 'H')).toBe(1);
  });

  it('played LOW (not led) loses', () => {
    expect(trickWinner([play(0, '7S'), play(1, 'X1', { mode: 'low' }), play(2, '8S'), play(3, '6D')], 'H')).toBe(2);
  });

  it('two Jokers: the later HIGH Joker wins', () => {
    expect(
      trickWinner([play(0, '7S'), play(1, 'X1', { mode: 'high' }), play(2, 'X2', { mode: 'high' }), play(3, '8S')], 'H'),
    ).toBe(2);
    // later Joker LOW does not beat the earlier HIGH one
    expect(
      trickWinner([play(0, '7S'), play(1, 'X1', { mode: 'high' }), play(2, 'X2', { mode: 'low' }), play(3, '8S')], 'H'),
    ).toBe(1);
  });

  it('two Jokers: led HIGH Joker is beaten by a second HIGH Joker', () => {
    expect(
      trickWinner([play(0, 'X1', { mode: 'high', suit: 'S' }), play(1, '9S'), play(2, 'X2', { mode: 'high' }), play(3, '8S')], 'H'),
    ).toBe(2);
    expect(
      trickWinner([play(0, 'X1', { mode: 'high', suit: 'S' }), play(1, '9S'), play(2, 'X2', { mode: 'low' }), play(3, '8S')], 'H'),
    ).toBe(0);
  });

  describe('led HIGH', () => {
    it('others must play their highest card of the named suit', () => {
      const trick = { plays: [play(0, 'X1', { mode: 'high', suit: 'D' })] };
      expect(ids(legalCards(cards('7D QD 9D AS X2'), trick, 'H'))).toEqual(['QD', 'X2']);
    });

    it('void in named suit: must trump, else anything', () => {
      const trick = { plays: [play(0, 'X1', { mode: 'high', suit: 'D' })] };
      expect(ids(legalCards(cards('7H QH AS'), trick, 'H'))).toEqual(['7H', 'QH']);
      expect(ids(legalCards(cards('7C AS'), trick, 'H'))).toEqual(['7C', 'AS']);
    });

    it('the Joker wins when nobody trumps', () => {
      expect(trickWinner([play(0, 'X1', { mode: 'high', suit: 'D' }), play(1, 'AD'), play(2, '7C'), play(3, 'KD')], 'H')).toBe(0);
    });

    it('is beaten by a trump when the named suit is not trump', () => {
      expect(trickWinner([play(0, 'X1', { mode: 'high', suit: 'D' }), play(1, 'AD'), play(2, '7H'), play(3, '9H')], 'H')).toBe(3);
    });

    it('cannot be beaten by trumps when the named suit is trump', () => {
      expect(trickWinner([play(0, 'X1', { mode: 'high', suit: 'H' }), play(1, 'AH'), play(2, '7H'), play(3, '9D')], 'H')).toBe(0);
    });

    it('wins in a no-trump hand', () => {
      expect(trickWinner([play(0, 'X1', { mode: 'high', suit: 'S' }), play(1, 'AS'), play(2, 'AH'), play(3, 'KS')], null)).toBe(0);
    });

    it('enforces highest-card rule via applyAction', () => {
      let s = playingState(['X1 6D', '7D QD', '8S 8D', '9S 9C'], 'H');
      s = applyAction(s, { type: 'play', playerId: 'a', cardId: 'X1', joker: { mode: 'high', suit: 'D' } });
      expect(() => applyAction(s, { type: 'play', playerId: 'b', cardId: '7D' })).toThrow();
      s = applyAction(s, { type: 'play', playerId: 'b', cardId: 'QD' });
      s = applyAction(s, { type: 'play', playerId: 'c', cardId: '8D' });
      s = applyAction(s, { type: 'play', playerId: 'd', cardId: '9S' });
      expect(s.tricks).toEqual([1, 0, 0, 0]);
    });
  });

  describe('led LOW', () => {
    it('counts as the lowest card of the named suit', () => {
      expect(trickWinner([play(0, 'X1', { mode: 'low', suit: 'S' }), play(1, '7S'), play(2, '9S'), play(3, 'AD')], 'H')).toBe(2);
    });

    it('wins if nobody follows the named suit or trumps', () => {
      expect(trickWinner([play(0, 'X1', { mode: 'low', suit: 'S' }), play(1, '7D'), play(2, '9C'), play(3, 'AD')], 'H')).toBe(0);
    });

    it('is beaten by trump', () => {
      expect(trickWinner([play(0, 'X1', { mode: 'low', suit: 'S' }), play(1, '7H'), play(2, '9C'), play(3, 'AS')], 'H')).toBe(1);
    });

    it('others follow the named suit normally (any card of it)', () => {
      const trick = { plays: [play(0, 'X1', { mode: 'low', suit: 'D' })] };
      expect(ids(legalCards(cards('7D QD AS'), trick, 'H'))).toEqual(['7D', 'QD']);
    });
  });
});
