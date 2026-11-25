import { describe, expect, it } from 'vitest';
import { MODES, applyAction, createGame, getLegalMoves, scoreHand, type GameState } from '../src';
import { PLAYERS, c, newGame, playingState } from './helpers';

describe('scoreHand', () => {
  it('exact bid → 50 × bid + 50', () => {
    expect(scoreHand(3, 3, 7, -200)).toEqual({ points: 200, khishti: false });
    expect(scoreHand(1, 1, 5, -200).points).toBe(100);
  });

  it('bid 0 made → 50', () => {
    expect(scoreHand(0, 0, 9, -200)).toEqual({ points: 50, khishti: false });
  });

  it('bid = hand size and made → 100 × tricks', () => {
    expect(scoreHand(9, 9, 9, -200).points).toBe(900);
    expect(scoreHand(5, 5, 5, -200).points).toBe(500);
  });

  it('over the bid → 10 × tricks taken', () => {
    expect(scoreHand(2, 4, 7, -200)).toEqual({ points: 40, khishti: false });
    expect(scoreHand(0, 3, 7, -200).points).toBe(30);
  });

  it('under the bid but took some → 10 × tricks taken', () => {
    expect(scoreHand(5, 2, 7, -200)).toEqual({ points: 20, khishti: false });
  });

  it.each([
    [-200, -200],
    [-500, -500],
    [-1000, -1000],
    [-350, -350],
    [750, -750], // custom positive input is treated as a penalty
  ])('bid ≥ 1 and took 0 → khishti %i', (setting, expected) => {
    expect(scoreHand(2, 0, 7, setting)).toEqual({ points: expected, khishti: true });
    expect(scoreHand(9, 0, 9, setting)).toEqual({ points: expected, khishti: true });
  });

  it('bid 0 and took 0 is never khishti', () => {
    expect(scoreHand(0, 0, 3, -1000).khishti).toBe(false);
  });
});

function finishOneTrickHand(s: GameState) {
  // play the single trick with first legal moves
  while (s.history.length === 0) s = applyAction(s, getLegalMoves(s, s.players[s.turn].id)[0]);
  return s;
}

describe('hand scoring in the game', () => {
  it('records results and totals after each hand, using the khishti setting', () => {
    const s = playingState(['AS', '7S', '8S', '9S'], null, [1, 1, 0, 0]);
    s.settings.khishti = -500;
    const done = finishOneTrickHand(s);
    const r = done.history[0].results;
    expect(r.map((x) => x.tricks)).toEqual([1, 0, 0, 0]);
    expect(r.map((x) => x.points)).toEqual([100, -500, 50, 50]);
    expect(r[1].khishti).toBe(true);
    expect(done.totals).toEqual([100, -500, 50, 50]);
  });

  it('custom khishti from createGame settings', () => {
    const s = newGame('standard', { khishti: -321 });
    expect(s.settings.khishti).toBe(-321);
  });

  it('pulka bonus is off by default and can be enabled', () => {
    expect(newGame().settings.pulkaBonus).toBe(false);
    expect(newGame('standard', { pulkaBonus: true }).settings.pulkaBonus).toBe(true);
  });

  it('pulka bonus: a player who makes every bid in the pulka gets their best hand again', () => {
    let s = newGame('standard', { pulkaBonus: true });
    // play the first pulka (8 hands); seat 0 always bids exactly what we force them to take is hard,
    // so instead verify the bonus formula on the recorded history.
    while (s.history.length < 8) s = applyAction(s, getLegalMoves(s, s.players[s.turn].id)[0]);
    const pulka = s.history.filter((h) => h.pulka === 0);
    s.players.forEach((_, seat) => {
      const res = pulka.map((h) => h.results[seat]);
      const allMade = res.every((r) => r.bid === r.tricks);
      const expected = allMade ? Math.max(...res.map((r) => r.points)) : 0;
      expect(pulka[7].results[seat].bonus).toBe(expected);
      const sum = res.reduce((a, r) => a + r.points + r.bonus, 0);
      expect(s.totals[seat]).toBe(sum);
    });
  });

  it('pulka bonus credits a perfect player and nobody else', () => {
    MODES.tiny = { id: 'tiny', pulkas: [[1, 1], [1]] };
    try {
      // seat 0 always bids 1 and holds the Joker; others bid 0 and hold low cards
      const playHand = (st: GameState) => {
        st.phase = 'bidding';
        st.trump = null;
        st.turn = (st.dealer + 1) % 4;
        st.hands = [[c('X1')], [c('7S')], [c('8D')], [c('9C')]];
        const bidFor = (seat: number) => (seat === 0 ? 1 : seat === 3 ? 1 : 0); // seat 3 misses
        while (st.phase === 'bidding') {
          const pid = st.players[st.turn].id;
          const want = bidFor(st.turn);
          const moves = getLegalMoves(st, pid);
          st = applyAction(st, moves.find((m) => (m as { bid: number }).bid === want) ?? moves[0]);
        }
        const before = st.history.length;
        while (st.history.length === before) {
          const pid = st.players[st.turn].id;
          const moves = getLegalMoves(st, pid);
          st = applyAction(st, moves.find((m) => (m as { joker?: { mode: string } }).joker?.mode === 'high') ?? moves[0]);
        }
        return st;
      };
      let s = createGame({ players: PLAYERS, settings: { mode: 'tiny', khishti: -200, turnTimer: 0, pulkaBonus: true }, seed: 1, firstDealer: 3 });
      s = playHand(s);
      expect(s.history[0].results[0].bonus).toBe(0); // not end of pulka yet
      s = playHand(s);
      const end = s.history[1].results;
      expect(s.history[0].results[0]).toMatchObject({ bid: 1, tricks: 1, points: 100 });
      expect(end[0].bonus).toBe(100); // made every bid → best hand (100) again
      expect(s.totals[0]).toBe(300);
      expect(end[3].bonus).toBe(0); // khishti player gets no bonus
      expect(end[3].khishti).toBe(true);
    } finally {
      delete MODES.tiny;
    }
  });
});
