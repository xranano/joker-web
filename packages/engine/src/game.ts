import { DEFAULT_SETTINGS, MODES, RULES, SUITS } from './config';
import { createDeck, nextRandom, shuffle, sortHand } from './cards';
import { jokerOptions, legalBids, legalCards, trickWinner } from './rules';
import { normalizeKhishti, scoreHand } from './scoring';
import type {
  Action,
  Card,
  CreateGameInput,
  GameSettings,
  GameState,
  HandRecord,
  PlayerView,
  ScheduledHand,
} from './types';

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}

export function buildSchedule(mode: string): ScheduledHand[] {
  const def = MODES[mode];
  if (!def) throw new Error(`Unknown mode: ${mode}`);
  return def.pulkas.flatMap((sizes, pulka) => sizes.map((size) => ({ pulka, size })));
}

export function normalizeSettings(settings: Partial<GameSettings>): Required<GameSettings> {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  if (!MODES[merged.mode]) throw new Error(`Unknown mode: ${merged.mode}`);
  const timer = (RULES.turnTimerOptions as readonly number[]).includes(merged.turnTimer) ? merged.turnTimer : 0;
  return {
    mode: merged.mode,
    khishti: normalizeKhishti(merged.khishti),
    turnTimer: timer,
    pulkaBonus: !!merged.pulkaBonus,
  };
}

const next = (seat: number) => (seat + 1) % RULES.players;

export function createGame(input: CreateGameInput): GameState {
  if (input.players.length !== RULES.players) throw new Error(`Need exactly ${RULES.players} players`);
  if (new Set(input.players.map((p) => p.id)).size !== input.players.length) throw new Error('Duplicate player ids');
  const settings = normalizeSettings(input.settings);
  let rng = (input.seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
  let dealer = input.firstDealer;
  if (dealer === undefined) {
    const [r, n] = nextRandom(rng);
    rng = n;
    dealer = Math.floor(r * RULES.players);
  }
  const schedule = buildSchedule(settings.mode);
  const state: GameState = {
    settings,
    players: input.players.map((p) => ({ id: p.id, name: p.name })),
    schedule,
    handIndex: 0,
    handSize: schedule[0].size,
    dealer,
    phase: 'bidding',
    turn: next(dealer),
    hands: [],
    deck: [],
    trump: null,
    trumpCard: null,
    bids: [],
    tricks: [],
    trick: { leader: next(dealer), plays: [] },
    lastTrick: null,
    history: [],
    totals: input.players.map(() => 0),
    rng,
  };
  deal(state);
  return state;
}

/** Mutates `state`: shuffles, deals the current hand and sets up trump/bidding. */
function deal(state: GameState): void {
  const size = state.schedule[state.handIndex].size;
  const [deck, rng] = shuffle(createDeck(), state.rng);
  state.rng = rng;
  state.handSize = size;
  state.hands = state.players.map(() => [] as Card[]);
  for (let i = 0; i < size * RULES.players; i++) {
    state.hands[(state.dealer + 1 + i) % RULES.players].push(deck[i]);
  }
  state.deck = deck.slice(size * RULES.players);
  state.bids = state.players.map(() => null);
  state.tricks = state.players.map(() => 0);
  state.trick = { leader: next(state.dealer), plays: [] };
  state.trump = null;
  state.trumpCard = null;
  state.turn = next(state.dealer);

  if (size >= RULES.chooseTrumpAtHandSize) {
    // chooser sees their first N cards (hands[] keeps deal order until trump is chosen)
    state.phase = 'trump';
  } else {
    const card = state.deck.shift() ?? null;
    state.trumpCard = card;
    state.trump = card && !card.joker ? card.suit : null;
    state.phase = 'bidding';
    state.hands = state.hands.map((h) => sortHand(h, state.trump));
  }
}

function seatOf(state: GameState, playerId: string): number {
  const seat = state.players.findIndex((p) => p.id === playerId);
  if (seat < 0) throw new IllegalActionError('Unknown player');
  return seat;
}

type HandSource = GameState | PlayerView;

function handOf(state: HandSource, seat: number): Card[] {
  if ('hands' in state) {
    const hand = state.hands[seat] ?? [];
    return state.phase === 'trump' ? hand.slice(0, RULES.trumpPreviewCards) : hand;
  }
  return state.seat === seat ? state.hand : [];
}

/**
 * Every legal action for `playerId` right now (empty if it is not their turn).
 * Accepts a full GameState or that player's PlayerView, so the client can use it too.
 */
export function getLegalMoves(state: HandSource, playerId: string): Action[] {
  const seat = state.players.findIndex((p) => p.id === playerId);
  if (seat < 0 || seat !== state.turn) return [];
  switch (state.phase) {
    case 'trump':
      return [...SUITS, null].map((suit) => ({ type: 'chooseTrump' as const, playerId, suit }));
    case 'bidding':
      return legalBids(state.bids, seat, state.dealer, state.handSize).map((bid) => ({
        type: 'bid' as const,
        playerId,
        bid,
      }));
    case 'playing': {
      const isLead = state.trick.plays.length === 0;
      return legalCards(handOf(state, seat), state.trick, state.trump).flatMap((card): Action[] =>
        card.joker
          ? jokerOptions(isLead).map((joker) => ({ type: 'play' as const, playerId, cardId: card.id, joker }))
          : [{ type: 'play' as const, playerId, cardId: card.id }],
      );
    }
    default:
      return [];
  }
}

function sameAction(a: Action, b: Action): boolean {
  if (a.type !== b.type || a.playerId !== b.playerId) return false;
  switch (a.type) {
    case 'chooseTrump':
      return a.suit === (b as typeof a).suit;
    case 'bid':
      return a.bid === (b as typeof a).bid;
    case 'play': {
      const p = b as typeof a;
      if (a.cardId !== p.cardId) return false;
      if (!a.joker && !p.joker) return true;
      return a.joker?.mode === p.joker?.mode && (a.joker?.suit ?? null) === (p.joker?.suit ?? null);
    }
  }
}

/** Pure: returns a new state. Throws IllegalActionError on any illegal action. */
export function applyAction(prev: GameState, action: Action): GameState {
  if (prev.phase === 'gameOver') throw new IllegalActionError('Game is over');
  const seat = seatOf(prev, action.playerId);
  if (seat !== prev.turn) throw new IllegalActionError('Not your turn');
  // Normalise a non-lead Joker choice (suit is irrelevant there)
  let normalized = action;
  if (action.type === 'play' && action.joker && prev.trick.plays.length > 0) {
    normalized = { ...action, joker: { mode: action.joker.mode } };
  }
  const legal = getLegalMoves(prev, action.playerId);
  if (!legal.some((m) => sameAction(m, normalized))) throw new IllegalActionError(`Illegal ${action.type}`);

  const state = structuredClone(prev);
  switch (normalized.type) {
    case 'chooseTrump':
      state.trump = normalized.suit;
      state.hands = state.hands.map((h) => sortHand(h, state.trump));
      state.phase = 'bidding';
      state.turn = next(state.dealer);
      break;
    case 'bid':
      state.bids[seat] = normalized.bid;
      if (state.bids.every((b) => b !== null)) {
        state.phase = 'playing';
        state.turn = next(state.dealer);
        state.trick = { leader: state.turn, plays: [] };
      } else {
        state.turn = next(seat);
      }
      break;
    case 'play': {
      const hand = state.hands[seat];
      const idx = hand.findIndex((c) => c.id === normalized.cardId);
      const [card] = hand.splice(idx, 1);
      state.trick.plays.push(normalized.joker ? { seat, card, joker: normalized.joker } : { seat, card });
      if (state.trick.plays.length < RULES.players) {
        state.turn = next(seat);
        break;
      }
      const winner = trickWinner(state.trick.plays, state.trump);
      state.tricks[winner]++;
      state.lastTrick = { ...state.trick, winner };
      if (state.hands.every((h) => h.length === 0)) {
        finishHand(state);
      } else {
        state.trick = { leader: winner, plays: [] };
        state.turn = winner;
      }
      break;
    }
  }
  return state;
}

function finishHand(state: GameState): void {
  const scheduled = state.schedule[state.handIndex];
  const record: HandRecord = {
    handIndex: state.handIndex,
    pulka: scheduled.pulka,
    handSize: state.handSize,
    dealer: state.dealer,
    trump: state.trump,
    results: state.players.map((_, seat) => {
      const bid = state.bids[seat]!;
      const tricks = state.tricks[seat];
      const s = scoreHand(bid, tricks, state.handSize, state.settings.khishti);
      return { bid, tricks, points: s.points, khishti: s.khishti, bonus: 0 };
    }),
  };
  state.history.push(record);
  record.results.forEach((r, seat) => (state.totals[seat] += r.points));

  const nextHand = state.schedule[state.handIndex + 1];
  const pulkaEnded = !nextHand || nextHand.pulka !== scheduled.pulka;
  if (pulkaEnded && state.settings.pulkaBonus) applyPulkaBonus(state, scheduled.pulka, record);

  state.handIndex++;
  if (!nextHand) {
    state.phase = 'gameOver';
    state.turn = -1;
    state.trick = { leader: -1, plays: [] };
    return;
  }
  state.dealer = next(state.dealer);
  deal(state);
}

/** A player who made every bid in the pulka gets their best hand score of the pulka again. */
function applyPulkaBonus(state: GameState, pulka: number, last: HandRecord): void {
  const hands = state.history.filter((h) => h.pulka === pulka);
  state.players.forEach((_, seat) => {
    const all = hands.map((h) => h.results[seat]);
    if (all.every((r) => r.bid === r.tricks)) {
      const bonus = Math.max(...all.map((r) => r.points));
      last.results[seat].bonus = bonus;
      state.totals[seat] += bonus;
    }
  });
}

/** Hides other players' cards, the undealt deck and the RNG state. */
export function getPlayerView(state: GameState, playerId: string | null): PlayerView {
  const { hands, deck, rng: _rng, ...shared } = state;
  const seatIdx = playerId === null ? -1 : state.players.findIndex((p) => p.id === playerId);
  const seat = seatIdx >= 0 ? seatIdx : null;
  let hand: Card[] = [];
  if (seat !== null) {
    hand = state.phase === 'trump' ? (seat === state.turn ? hands[seat].slice(0, RULES.trumpPreviewCards) : []) : hands[seat];
  }
  return structuredClone({
    ...shared,
    seat,
    hand,
    handCounts: hands.map((h) => h.length),
    deckCount: deck.length,
  });
}

/** Ranking: highest total first; ties share the same place. */
export function getRankings(state: Pick<GameState, 'players' | 'totals'>) {
  const rows = state.players.map((p, seat) => ({ seat, playerId: p.id, name: p.name, total: state.totals[seat] }));
  rows.sort((a, b) => b.total - a.total);
  return rows.map((r) => ({ ...r, place: rows.findIndex((x) => x.total === r.total) + 1 }));
}
