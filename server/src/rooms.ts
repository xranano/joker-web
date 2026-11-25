import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import {
  DEFAULT_SETTINGS,
  MODES,
  RULES,
  SUITS,
  applyAction,
  chooseBotAction,
  createGame,
  getPlayerView,
  normalizeSettings,
  type Action,
  type GameSettings,
  type GameState,
  type Suit,
} from '@joker/engine';
import type { ActionInput, JoinError, PublicSeat, RoomSnapshot, RoomStatus } from '@joker/engine/protocol';
import { makeRoomCode, sanitizeName } from './names';

export interface Seat {
  /** secret identity from the client's localStorage */
  playerId: string;
  /** id used inside the engine and visible to everyone */
  publicId: string;
  name: string;
  isBot: boolean;
  sockets: Set<string>;
  disconnectedAt: number | null;
}

export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  settings: Required<GameSettings>;
  seats: (Seat | null)[];
  kicked: Set<string>;
  game: GameState | null;
  /** bumped on every game change; guards stale timers */
  version: number;
  timer: NodeJS.Timeout | null;
  turnDeadline: number | null;
  trickJustEnded: boolean;
  emptySince: number | null;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface Transport {
  sendState(socketId: string, snapshot: RoomSnapshot): void;
  sendKicked(socketId: string): void;
}

const MAX_ROOMS = 5000;
const now = () => Date.now();

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  /** socketId → { code, playerId } */
  private sockets = new Map<string, { code: string; playerId: string }>();

  constructor(private transport: Transport) {}

  // ───────────────────────── lobby ─────────────────────────

  createRoom(playerId: string): Result<{ code: string }> {
    if (this.rooms.size >= MAX_ROOMS) return { ok: false, error: 'serverFull' };
    let code = makeRoomCode();
    while (this.rooms.has(code)) code = makeRoomCode();
    this.rooms.set(code, {
      code,
      hostId: playerId,
      status: 'lobby',
      settings: normalizeSettings(DEFAULT_SETTINGS),
      seats: Array(RULES.players).fill(null),
      kicked: new Set(),
      game: null,
      version: 0,
      timer: null,
      turnDeadline: null,
      trickJustEnded: false,
      emptySince: now(),
    });
    return { ok: true, code };
  }

  join(socketId: string, code: string, playerId: string, rawName?: string): Result {
    const room = this.rooms.get(code);
    if (!room) return this.fail('notFound');

    const existing = room.seats.findIndex((s) => s && !s.isBot && s.playerId === playerId);
    if (existing >= 0) {
      // reconnect to the same seat (and hand)
      this.detachSocket(socketId);
      const seat = room.seats[existing]!;
      seat.sockets.add(socketId);
      seat.disconnectedAt = null;
      this.sockets.set(socketId, { code, playerId });
      room.emptySince = null;
      this.broadcast(room);
      this.schedule(room);
      return { ok: true };
    }

    if (room.status !== 'lobby') return this.fail('inProgress');
    if (room.kicked.has(playerId)) return this.fail('kicked');
    const free = room.seats.findIndex((s) => s === null);
    if (free < 0) return this.fail('full');
    if (rawName === undefined) return this.fail('needName');
    const name = sanitizeName(rawName);
    if (!name || /^bot\s*\d+$/i.test(name)) return this.fail('invalidName');
    if (this.nameTaken(room, name)) return this.fail('nameTaken');

    this.detachSocket(socketId);
    room.seats[free] = {
      playerId,
      publicId: this.newPublicId(),
      name,
      isBot: false,
      sockets: new Set([socketId]),
      disconnectedAt: null,
    };
    this.sockets.set(socketId, { code, playerId });
    room.emptySince = null;
    this.ensureHost(room);
    this.broadcast(room);
    return { ok: true };
  }

  leave(socketId: string): Result {
    const ctx = this.ctx(socketId);
    if (!ctx) return { ok: true };
    const { room, seatIdx } = ctx;
    this.detachSocket(socketId);
    if (seatIdx < 0) return { ok: true };
    if (room.status === 'lobby') {
      room.seats[seatIdx] = null;
      this.ensureHost(room);
    } else {
      // explicit leave mid-game: a bot takes over right away
      const seat = room.seats[seatIdx]!;
      for (const s of seat.sockets) this.sockets.delete(s);
      seat.sockets.clear();
      seat.disconnectedAt = now() - RULES.timing.disconnectGraceMs;
      this.schedule(room);
    }
    this.touchEmpty(room);
    this.broadcast(room);
    return { ok: true };
  }

  disconnect(socketId: string): void {
    const ctx = this.ctx(socketId);
    this.detachSocket(socketId);
    if (!ctx) return;
    this.touchEmpty(ctx.room);
    this.broadcast(ctx.room);
    this.schedule(ctx.room);
  }

  updateSettings(socketId: string, patch: Partial<GameSettings>): Result {
    const ctx = this.hostCtx(socketId);
    if (!ctx.ok) return ctx;
    const { room } = ctx;
    if (room.status === 'playing') return { ok: false, error: 'inProgress' };
    const merged: Partial<GameSettings> = { ...room.settings };
    if (typeof patch.mode === 'string' && MODES[patch.mode]) merged.mode = patch.mode;
    if (typeof patch.khishti === 'number' && Number.isFinite(patch.khishti)) {
      merged.khishti = Math.max(-100_000, Math.min(100_000, patch.khishti));
    }
    if (typeof patch.turnTimer === 'number') merged.turnTimer = patch.turnTimer;
    if (typeof patch.pulkaBonus === 'boolean') merged.pulkaBonus = patch.pulkaBonus;
    room.settings = normalizeSettings(merged);
    this.broadcast(room);
    return { ok: true };
  }

  addBot(socketId: string, seatIdx: number): Result {
    const ctx = this.hostCtx(socketId);
    if (!ctx.ok) return ctx;
    const { room } = ctx;
    if (room.status !== 'lobby') return { ok: false, error: 'inProgress' };
    if (!this.validSeat(seatIdx) || room.seats[seatIdx]) return { ok: false, error: 'seatTaken' };
    let n = 1;
    while (this.nameTaken(room, `Bot ${n}`)) n++;
    room.seats[seatIdx] = {
      playerId: `bot-${randomUUID()}`,
      publicId: this.newPublicId(),
      name: `Bot ${n}`,
      isBot: true,
      sockets: new Set(),
      disconnectedAt: null,
    };
    this.broadcast(room);
    return { ok: true };
  }

  kick(socketId: string, seatIdx: number): Result {
    const ctx = this.hostCtx(socketId);
    if (!ctx.ok) return ctx;
    const { room } = ctx;
    if (room.status !== 'lobby') return { ok: false, error: 'inProgress' };
    if (!this.validSeat(seatIdx)) return { ok: false, error: 'badSeat' };
    const seat = room.seats[seatIdx];
    if (!seat) return { ok: true };
    if (seat.playerId === room.hostId) return { ok: false, error: 'cannotKickHost' };
    room.seats[seatIdx] = null;
    if (!seat.isBot) {
      room.kicked.add(seat.playerId);
      for (const s of seat.sockets) {
        this.sockets.delete(s);
        this.transport.sendKicked(s);
      }
    }
    this.broadcast(room);
    return { ok: true };
  }

  start(socketId: string): Result {
    const ctx = this.hostCtx(socketId);
    if (!ctx.ok) return ctx;
    const { room } = ctx;
    if (room.status === 'playing') return { ok: false, error: 'inProgress' };
    if (room.seats.some((s) => s === null)) return { ok: false, error: 'seatsNotFilled' };
    this.newGame(room);
    return { ok: true };
  }

  playAgain(socketId: string): Result {
    const ctx = this.hostCtx(socketId);
    if (!ctx.ok) return ctx;
    if (ctx.room.status !== 'finished') return { ok: false, error: 'notFinished' };
    this.newGame(ctx.room);
    return { ok: true };
  }

  // ───────────────────────── game ─────────────────────────

  action(socketId: string, input: ActionInput): Result {
    const ctx = this.ctx(socketId);
    if (!ctx || ctx.seatIdx < 0) return { ok: false, error: 'notSeated' };
    const { room, seatIdx } = ctx;
    if (!room.game || room.status !== 'playing') return { ok: false, error: 'noGame' };
    const action = parseAction(input, room.seats[seatIdx]!.publicId);
    if (!action) return { ok: false, error: 'badAction' };
    try {
      this.apply(room, action);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'illegal' };
    }
  }

  private newGame(room: Room): void {
    const seats = room.seats as Seat[];
    room.game = createGame({
      players: seats.map((s) => ({ id: s.publicId, name: s.name })),
      settings: room.settings,
      seed: randomBytes(4).readUInt32LE(0),
      firstDealer: randomInt(RULES.players),
    });
    room.status = 'playing';
    room.version++;
    room.trickJustEnded = false;
    this.broadcast(room);
    this.schedule(room);
  }

  private apply(room: Room, action: Action): void {
    const prev = room.game!;
    const next = applyAction(prev, action); // throws if illegal
    room.trickJustEnded = action.type === 'play' && prev.trick.plays.length === RULES.players - 1;
    room.game = next;
    room.version++;
    if (next.phase === 'gameOver') room.status = 'finished';
    this.schedule(room);
    this.broadcast(room);
  }

  /** Arms the timer for whoever acts next: bot, disconnected human, or turn timer. */
  private schedule(room: Room): void {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    room.turnDeadline = null;
    const game = room.game;
    if (!game || game.phase === 'gameOver' || room.status !== 'playing') return;
    const seat = room.seats[game.turn];
    if (!seat) return;
    const pause = room.trickJustEnded ? RULES.timing.trickPauseMs : 0;
    let delay: number;
    if (seat.isBot) {
      delay = RULES.timing.botDelayMs + pause;
    } else if (seat.sockets.size === 0 && seat.disconnectedAt !== null) {
      delay = Math.max(RULES.timing.botDelayMs, seat.disconnectedAt + RULES.timing.disconnectGraceMs - now()) + pause;
    } else if (room.settings.turnTimer > 0) {
      delay = room.settings.turnTimer * 1000 + pause;
      room.turnDeadline = now() + delay;
    } else {
      return;
    }
    const version = room.version;
    const turn = game.turn;
    room.timer = setTimeout(() => this.autoPlay(room, version, turn), delay);
  }

  private autoPlay(room: Room, version: number, turn: number): void {
    room.timer = null;
    if (!this.rooms.has(room.code) || room.version !== version || !room.game || room.game.turn !== turn) return;
    const pid = room.game.players[turn].id;
    try {
      this.apply(room, chooseBotAction(getPlayerView(room.game, pid), pid));
    } catch (e) {
      console.error(`[${room.code}] auto-play failed`, e);
    }
  }

  // ───────────────────────── housekeeping ─────────────────────────

  /** Deletes rooms with nobody connected for longer than the TTL. */
  sweep(): void {
    const t = now();
    for (const room of this.rooms.values()) {
      this.touchEmpty(room);
      if (room.emptySince !== null && t - room.emptySince > RULES.timing.emptyRoomTtlMs) {
        if (room.timer) clearTimeout(room.timer);
        this.rooms.delete(room.code);
      }
    }
  }

  snapshotFor(room: Room, playerId: string | null): RoomSnapshot {
    const seatIdx = playerId ? room.seats.findIndex((s) => s?.playerId === playerId) : -1;
    const t = now();
    const seats: (PublicSeat | null)[] = room.seats.map((s) =>
      s
        ? {
            name: s.name,
            isBot: s.isBot,
            isHost: s.playerId === room.hostId,
            connected: s.isBot || s.sockets.size > 0,
            autoPlay:
              !s.isBot &&
              s.sockets.size === 0 &&
              s.disconnectedAt !== null &&
              room.status === 'playing' &&
              t - s.disconnectedAt >= RULES.timing.disconnectGraceMs,
          }
        : null,
    );
    const publicId = seatIdx >= 0 ? room.seats[seatIdx]!.publicId : null;
    return {
      code: room.code,
      status: room.status,
      settings: room.settings,
      seats,
      you: { seat: seatIdx >= 0 ? seatIdx : null, isHost: playerId === room.hostId },
      game: room.game ? getPlayerView(room.game, publicId) : null,
      turnDeadline: room.turnDeadline,
      serverNow: t,
    };
  }

  private broadcast(room: Room): void {
    for (const seat of room.seats) {
      if (!seat || seat.isBot || seat.sockets.size === 0) continue;
      const snap = this.snapshotFor(room, seat.playerId);
      for (const sid of seat.sockets) this.transport.sendState(sid, snap);
    }
  }

  // ───────────────────────── helpers ─────────────────────────

  private fail(error: JoinError): Result {
    return { ok: false, error };
  }

  private ctx(socketId: string) {
    const info = this.sockets.get(socketId);
    if (!info) return null;
    const room = this.rooms.get(info.code);
    if (!room) return null;
    const seatIdx = room.seats.findIndex((s) => s && !s.isBot && s.playerId === info.playerId);
    return { room, seatIdx, playerId: info.playerId };
  }

  private hostCtx(socketId: string): Result<{ room: Room }> {
    const ctx = this.ctx(socketId);
    if (!ctx) return { ok: false, error: 'notInRoom' };
    if (ctx.playerId !== ctx.room.hostId) return { ok: false, error: 'notHost' };
    return { ok: true, room: ctx.room };
  }

  private detachSocket(socketId: string): void {
    const info = this.sockets.get(socketId);
    if (!info) return;
    this.sockets.delete(socketId);
    const room = this.rooms.get(info.code);
    const seat = room?.seats.find((s) => s && !s.isBot && s.playerId === info.playerId);
    if (seat) {
      seat.sockets.delete(socketId);
      if (seat.sockets.size === 0) seat.disconnectedAt = now();
    }
  }

  /** Host stays with the creator while seated; in the lobby it passes on if they leave. */
  private ensureHost(room: Room): void {
    const humans = room.seats.filter((s): s is Seat => !!s && !s.isBot);
    if (humans.some((s) => s.playerId === room.hostId)) return;
    if (humans.length > 0) room.hostId = humans[0].playerId;
  }

  private touchEmpty(room: Room): void {
    const anyone = room.seats.some((s) => s && !s.isBot && s.sockets.size > 0);
    if (anyone) room.emptySince = null;
    else if (room.emptySince === null) room.emptySince = now();
  }

  private nameTaken(room: Room, name: string): boolean {
    const key = name.toLocaleLowerCase();
    return room.seats.some((s) => s && s.name.toLocaleLowerCase() === key);
  }

  private validSeat(i: unknown): i is number {
    return Number.isInteger(i) && (i as number) >= 0 && (i as number) < RULES.players;
  }

  private newPublicId(): string {
    return randomBytes(6).toString('hex');
  }
}

/** Builds a clean engine Action from untrusted input (never passes extra fields through). */
export function parseAction(input: unknown, playerId: string): Action | null {
  if (!input || typeof input !== 'object') return null;
  const a = input as Record<string, unknown>;
  const isSuit = (s: unknown): s is Suit => typeof s === 'string' && (SUITS as readonly string[]).includes(s);
  switch (a.type) {
    case 'chooseTrump':
      if (a.suit !== null && !isSuit(a.suit)) return null;
      return { type: 'chooseTrump', playerId, suit: a.suit };
    case 'bid':
      if (!Number.isInteger(a.bid)) return null;
      return { type: 'bid', playerId, bid: a.bid as number };
    case 'play': {
      if (typeof a.cardId !== 'string' || a.cardId.length > 4) return null;
      if (a.joker === undefined || a.joker === null) return { type: 'play', playerId, cardId: a.cardId };
      const j = a.joker as Record<string, unknown>;
      if (j.mode !== 'high' && j.mode !== 'low') return null;
      if (j.suit !== undefined && !isSuit(j.suit)) return null;
      return { type: 'play', playerId, cardId: a.cardId, joker: j.suit ? { mode: j.mode, suit: j.suit } : { mode: j.mode } };
    }
    default:
      return null;
  }
}
