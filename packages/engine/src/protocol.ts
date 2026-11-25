/**
 * Socket.IO wire protocol shared by server and client (types only).
 *
 * Note: the secret `playerId` (UUID in localStorage) is never sent to other clients.
 * Inside a game each seat uses a separate public id (`GameState.players[seat].id`).
 */
import type { GameSettings, JokerChoice, PlayerView, Suit } from './types';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface PublicSeat {
  name: string;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
  /** a disconnected human whose turns are currently played by a bot */
  autoPlay: boolean;
}

export interface RoomSnapshot {
  code: string;
  status: RoomStatus;
  settings: Required<GameSettings>;
  seats: (PublicSeat | null)[];
  you: { seat: number | null; isHost: boolean };
  game: PlayerView | null;
  /** epoch ms when the current turn times out (turn timer on), else null */
  turnDeadline: number | null;
  /** server clock, to correct the client's timer for clock skew */
  serverNow: number;
}

/** Actions as sent by the client – the server adds playerId. */
export type ActionInput =
  | { type: 'chooseTrump'; suit: Suit | null }
  | { type: 'bid'; bid: number }
  | { type: 'play'; cardId: string; joker?: JokerChoice };

export type JoinError = 'notFound' | 'needName' | 'full' | 'inProgress' | 'nameTaken' | 'invalidName' | 'kicked';

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface ClientToServerEvents {
  'room:create': (p: { playerId: string }, ack: Ack<{ code: string }>) => void;
  'room:join': (p: { code: string; playerId: string; name?: string }, ack: Ack) => void;
  'room:leave': (ack?: Ack) => void;
  'room:settings': (p: Partial<GameSettings>, ack?: Ack) => void;
  'room:addBot': (p: { seat: number }, ack?: Ack) => void;
  'room:kick': (p: { seat: number }, ack?: Ack) => void;
  'room:start': (ack?: Ack) => void;
  'game:action': (p: ActionInput, ack?: Ack) => void;
  'game:playAgain': (ack?: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (s: RoomSnapshot) => void;
  'room:kicked': () => void;
}
