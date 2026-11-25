import { describe, expect, it } from 'vitest';
import { applyAction, chooseBotAction, createGame, getLegalMoves, getPlayerView } from '../src';
import { PLAYERS, playingState } from './helpers';

describe('bots', () => {
  it('always choose a legal move and can finish full games in both modes', () => {
    for (const mode of ['standard', 'nines']) {
      for (let seed = 1; seed <= 5; seed++) {
        let s = createGame({ players: PLAYERS, settings: { mode, khishti: -200, turnTimer: 0 }, seed });
        while (s.phase !== 'gameOver') {
          const pid = s.players[s.turn].id;
          // bots only get their own view
          s = applyAction(s, chooseBotAction(getPlayerView(s, pid), pid));
        }
        expect(s.history.length).toBe(mode === 'standard' ? 24 : 16);
      }
    }
  });

  it('respects the dealer restriction', () => {
    let s = createGame({ players: PLAYERS, settings: { mode: 'standard', khishti: -200, turnTimer: 0 }, seed: 7, firstDealer: 3 });
    s = applyAction(s, { type: 'bid', playerId: 'a', bid: 0 });
    s = applyAction(s, { type: 'bid', playerId: 'b', bid: 0 });
    s = applyAction(s, { type: 'bid', playerId: 'c', bid: 0 });
    expect(chooseBotAction(s, 'd')).toEqual({ type: 'bid', playerId: 'd', bid: 0 });
  });

  it('wins cheaply when it needs tricks', () => {
    let s = playingState(['9S 6D', 'KS AS', '7D 8D', '7C 8C'], 'H', [0, 1, 0, 0]);
    s = applyAction(s, { type: 'play', playerId: 'a', cardId: '9S' });
    expect(chooseBotAction(s, 'b')).toMatchObject({ cardId: 'KS' });
  });

  it('dumps high losing cards / Joker LOW when its bid is reached', () => {
    let s = playingState(['QS 6D', 'KS 7S', '7D 8D', '7C 8C'], 'H', [0, 0, 0, 0]);
    s = applyAction(s, { type: 'play', playerId: 'a', cardId: 'QS' });
    expect(chooseBotAction(s, 'b')).toMatchObject({ cardId: '7S' });
    let t = playingState(['QS 6D', 'X1 AS', '7D 8D', '7C 8C'], 'H', [0, 0, 0, 0]);
    t = applyAction(t, { type: 'play', playerId: 'a', cardId: 'QS' });
    expect(chooseBotAction(t, 'b')).toMatchObject({ cardId: 'X1', joker: { mode: 'low' } });
  });

  it('every bot move is in getLegalMoves', () => {
    let s = createGame({ players: PLAYERS, settings: { mode: 'standard', khishti: -200, turnTimer: 0 }, seed: 99 });
    for (let i = 0; i < 200 && s.phase !== 'gameOver'; i++) {
      const pid = s.players[s.turn].id;
      const a = chooseBotAction(s, pid);
      expect(getLegalMoves(s, pid)).toContainEqual(a);
      s = applyAction(s, a);
    }
  });
});
