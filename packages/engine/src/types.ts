/** ♠ Spades, ♣ Clubs, ♥ Hearts, ♦ Diamonds */
export type Suit = 'S' | 'C' | 'H' | 'D';

export interface Card {
  /** e.g. "AS", "10H", "6D"; jokers are "X1" / "X2" */
  id: string;
  /** null for jokers */
  suit: Suit | null;
  /** 6..14 (11=J, 12=Q, 13=K, 14=A); 0 for jokers */
  rank: number;
  joker: boolean;
}

export type JokerMode = 'high' | 'low';

export interface JokerChoice {
  mode: JokerMode;
  /** Required when the Joker is led; ignored otherwise */
  suit?: Suit;
}

export interface Player {
  id: string;
  name: string;
}

export interface GameSettings {
  /** key of MODES in config.ts */
  mode: string;
  /** negative number applied when bid >= 1 and 0 tricks taken */
  khishti: number;
  /** seconds per turn, 0 = off (enforced by the server) */
  turnTimer: number;
  /** pulka bonus; defaults to RULES.pulkaBonus.enabled */
  pulkaBonus?: boolean;
}

export type Phase = 'trump' | 'bidding' | 'playing' | 'gameOver';

export interface TrickPlay {
  seat: number;
  card: Card;
  joker?: JokerChoice;
}

export interface Trick {
  leader: number;
  plays: TrickPlay[];
}

export interface CompletedTrick extends Trick {
  winner: number;
}

export interface PlayerHandResult {
  bid: number;
  tricks: number;
  points: number;
  khishti: boolean;
  /** pulka bonus credited on the last hand of a pulka (0 if none) */
  bonus: number;
}

export interface HandRecord {
  handIndex: number;
  pulka: number;
  handSize: number;
  dealer: number;
  trump: Suit | null;
  results: PlayerHandResult[];
}

export interface ScheduledHand {
  pulka: number;
  size: number;
}

export interface GameState {
  settings: Required<GameSettings>;
  /** seat order; index = seat; clockwise = increasing index */
  players: Player[];
  schedule: ScheduledHand[];
  handIndex: number;
  handSize: number;
  dealer: number;
  phase: Phase;
  /** seat expected to act (trump chooser in 'trump'); -1 when game over */
  turn: number;
  /** by seat */
  hands: Card[][];
  /** undealt cards (hidden from players) */
  deck: Card[];
  trump: Suit | null;
  /** turned-up card in hands < 9 (a Joker here means no trump) */
  trumpCard: Card | null;
  bids: (number | null)[];
  tricks: number[];
  trick: Trick;
  lastTrick: CompletedTrick | null;
  history: HandRecord[];
  totals: number[];
  /** RNG state (hidden from players) */
  rng: number;
}

export type Action =
  | { type: 'chooseTrump'; playerId: string; suit: Suit | null }
  | { type: 'bid'; playerId: string; bid: number }
  | { type: 'play'; playerId: string; cardId: string; joker?: JokerChoice };

/** What a single player is allowed to see. */
export interface PlayerView extends Omit<GameState, 'hands' | 'deck' | 'rng'> {
  /** viewer's seat, or null for a spectator */
  seat: number | null;
  /** viewer's own visible cards */
  hand: Card[];
  /** number of cards each seat holds */
  handCounts: number[];
  deckCount: number;
}

export interface CreateGameInput {
  players: Player[];
  settings: GameSettings;
  /** RNG seed; random if omitted */
  seed?: number;
  /** first dealer seat; random (from seed) if omitted */
  firstDealer?: number;
}
