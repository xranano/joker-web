import { describe, expect, it } from 'vitest';
import { applyAction, createGame, getLegalMoves, getPlayerView } from '../src';
import { PLAYERS, newGame } from './helpers';

describe('trump selection', () => {
  it('hands under 9: turns up the next card as trump and goes straight to bidding', () => {
    const s = newGame('standard');
    expect(s.handSize).toBe(1);
    expect(s.phase).toBe('bidding');
    expect(s.trumpCard).not.toBeNull();
    expect(s.deck).toHaveLength(36 - 4 - 1);
    if (s.trumpCard!.joker) expect(s.trump).toBeNull();
    else expect(s.trump).toBe(s.trumpCard!.suit);
  });

  it('a turned-up Joker means no trump', () => {
    // search seeds for one whose turned-up card is a joker
    for (let seed = 0; seed < 500; seed++) {
      const s = createGame({ players: PLAYERS, settings: { mode: 'standard', khishti: -200, turnTimer: 0 }, seed, firstDealer: 0 });
      if (s.trumpCard?.joker) {
        expect(s.trump).toBeNull();
        return;
      }
    }
    throw new Error('no seed produced a joker trump card');
  });

  it('nines mode: player after dealer picks trump after seeing 3 cards, every hand', () => {
    let s = newGame('nines');
    for (let hand = 0; hand < 3; hand++) {
      expect(s.phase).toBe('trump');
      expect(s.trumpCard).toBeNull();
      const chooser = (s.dealer + 1) % 4;
      expect(s.turn).toBe(chooser);
      const chooserId = s.players[chooser].id;
      expect(getPlayerView(s, chooserId).hand).toHaveLength(3);
      const other = s.players[(chooser + 1) % 4].id;
      expect(getPlayerView(s, other).hand).toHaveLength(0);
      expect(getLegalMoves(s, other)).toEqual([]);
      const moves = getLegalMoves(s, chooserId);
      expect(moves.map((m) => (m as { suit: unknown }).suit)).toEqual(['S', 'C', 'H', 'D', null]);
      s = applyAction(s, { type: 'chooseTrump', playerId: chooserId, suit: hand === 1 ? null : 'H' });
      expect(s.trump).toBe(hand === 1 ? null : 'H');
      expect(s.phase).toBe('bidding');
      expect(getPlayerView(s, chooserId).hand).toHaveLength(9);
      const startHand = s.history.length;
      while (s.history.length === startHand) s = applyAction(s, getLegalMoves(s, s.players[s.turn].id)[0]);
    }
  });

  it('standard mode 9-card hands use the chooser', () => {
    let s = newGame('standard');
    while (s.handSize !== 9) s = applyAction(s, getLegalMoves(s, s.players[s.turn].id)[0]);
    expect(s.phase).toBe('trump');
    expect(s.turn).toBe((s.dealer + 1) % 4);
  });

  it('rejects trump choice from the wrong player', () => {
    const s = newGame('nines');
    const wrong = s.players[(s.turn + 1) % 4].id;
    expect(() => applyAction(s, { type: 'chooseTrump', playerId: wrong, suit: 'S' })).toThrow();
  });
});
