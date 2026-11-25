/** End-to-end smoke test against a running server: `npm run smoke -w server` */
import { io, type Socket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { chooseBotAction, type Action } from '@joker/engine';
import type { ClientToServerEvents, RoomSnapshot, ServerToClientEvents } from '@joker/engine/protocol';

const URL = process.env.SERVER_URL ?? 'http://localhost:4000';
type S = Socket<ServerToClientEvents, ClientToServerEvents>;
const connect = () => io(URL, { transports: ['websocket'], forceNew: true }) as S;
const call = <T>(fn: (cb: (r: T) => void) => void) => new Promise<T>((res) => fn(res));
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok -', msg);
};

const hostId = randomUUID();
const host = connect();
let latest: RoomSnapshot | null = null;
host.on('room:state', (s) => (latest = s));

const created = await call<any>((cb) => host.emit('room:create', { playerId: hostId }, cb));
assert(created.ok && created.code.length === 6, 'room created ' + created.code);
const code = created.code;
assert((await call<any>((cb) => host.emit('room:join', { code, playerId: hostId }, cb))).error === 'needName', 'join without name → needName');
assert((await call<any>((cb) => host.emit('room:join', { code, playerId: hostId, name: '  <b>Nino</b>  ' }, cb))).ok, 'host joins');
await new Promise((r) => setTimeout(r, 100));
assert(latest!.seats[0]?.name === 'bNino/b' && latest!.you.isHost, 'name sanitized, host flag set');

const guest = connect();
const guestId = randomUUID();
let guestState: RoomSnapshot | null = null;
guest.on('room:state', (s) => (guestState = s));
assert((await call<any>((cb) => guest.emit('room:join', { code, playerId: guestId, name: 'bnino/B' }, cb))).error === 'nameTaken', 'duplicate name rejected');
assert((await call<any>((cb) => guest.emit('room:join', { code, playerId: guestId, name: 'Giorgi' }, cb))).ok, 'guest joins');
assert(!(await call<any>((cb) => guest.emit('room:start', cb))).ok, 'non-host cannot start');
assert(!(await call<any>((cb) => host.emit('room:start', cb))).ok, 'cannot start with empty seats');
await call((cb) => host.emit('room:settings', { mode: 'standard', khishti: 500, turnTimer: 30 }, cb));
await call((cb) => host.emit('room:addBot', { seat: 2 }, cb));
await call((cb) => host.emit('room:addBot', { seat: 3 }, cb));
await new Promise((r) => setTimeout(r, 100));
assert(guestState!.settings.khishti === -500 && guestState!.settings.turnTimer === 30, 'settings visible to guest');
assert(guestState!.seats.filter((s) => s?.isBot).length === 2, 'two bots seated');
assert((await call<any>((cb) => host.emit('room:start', cb))).ok, 'host starts');
await new Promise((r) => setTimeout(r, 100));

const json = JSON.stringify(guestState);
assert(!json.includes(hostId) && !json.includes('"deck"') && !json.includes('"rng"'), 'no secret ids / deck / rng in snapshot');
assert(guestState!.game!.hand.length === guestState!.game!.handSize || guestState!.game!.phase === 'trump', 'guest sees own hand');

const stranger = connect();
assert((await call<any>((cb) => stranger.emit('room:join', { code, playerId: randomUUID(), name: 'Late' }, cb))).error === 'inProgress', 'late visitor → inProgress');
stranger.close();

// guest refreshes: new socket, same playerId → same seat and hand
const handBefore = JSON.stringify(guestState!.game!.hand);
guest.close();
const guest2 = connect();
guest2.on('room:state', (s) => (guestState = s));
assert((await call<any>((cb) => guest2.emit('room:join', { code, playerId: guestId }, cb))).ok, 'guest reconnects');
await new Promise((r) => setTimeout(r, 100));
assert(guestState!.you.seat === 1 && (JSON.stringify(guestState!.game!.hand) === handBefore || guestState!.game!.hand.length < JSON.parse(handBefore).length), 'same seat and hand after reconnect');

// both humans play with the bot brain until 3 hands are finished
const drive = (sock: S, get: () => RoomSnapshot | null) => {
  const tick = () => {
    const s = get();
    const g = s?.game;
    if (!g || g.seat === null || g.turn !== g.seat || g.phase === 'gameOver') return;
    const pid = g.players[g.seat].id;
    const a = chooseBotAction(g, pid) as Action;
    const { playerId: _p, ...input } = a as any;
    sock.emit('game:action', input, (r: any) => { if (!r.ok) console.error('action rejected', r); });
  };
  sock.on('room:state', () => setTimeout(tick, 20));
  tick();
};
drive(host, () => latest);
drive(guest2, () => guestState);
const t0 = Date.now();
while ((latest?.game?.history.length ?? 0) < 3) {
  if (Date.now() - t0 > 60_000) throw new Error('FAIL: game stalled');
  await new Promise((r) => setTimeout(r, 200));
}
assert(latest!.game!.history.length >= 3, `3 hands played (totals ${latest!.game!.totals.join(', ')})`);
assert(latest!.turnDeadline !== null || latest!.game!.turn !== latest!.game!.seat, 'turn timer deadline sent');
host.close();
guest2.close();
console.log('SMOKE PASSED');
process.exit(0);
