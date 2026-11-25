import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@joker/engine/protocol';
import { RoomManager, type Result } from './rooms';
import { isValidPlayerId, normalizeRoomCode } from './names';

const PORT = Number(process.env.PORT ?? 4000);
/** Comma-separated list of allowed web origins, e.g. "https://joker.vercel.app". Unset = allow all (dev). */
const ORIGINS = process.env.CLIENT_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: manager.rooms.size }));
    return;
  }
  res.writeHead(404).end();
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(http, {
  cors: { origin: ORIGINS && ORIGINS.length > 0 ? ORIGINS : true },
  maxHttpBufferSize: 10_000,
});

const manager = new RoomManager({
  sendState: (sid, snap) => io.to(sid).emit('room:state', snap),
  sendKicked: (sid) => io.to(sid).emit('room:kicked'),
});

const reply = <T extends object>(ack: unknown, res: Result<T>) => {
  if (typeof ack === 'function') ack(res);
};

io.on('connection', (socket) => {
  socket.on('room:create', (p, ack) => {
    if (!isValidPlayerId(p?.playerId)) return reply(ack, { ok: false, error: 'badPlayerId' });
    reply(ack, manager.createRoom(p.playerId));
  });

  socket.on('room:join', (p, ack) => {
    const code = normalizeRoomCode(p?.code);
    if (!code) return reply(ack, { ok: false, error: 'notFound' });
    if (!isValidPlayerId(p?.playerId)) return reply(ack, { ok: false, error: 'badPlayerId' });
    reply(ack, manager.join(socket.id, code, p.playerId, typeof p.name === 'string' ? p.name : undefined));
  });

  socket.on('room:leave', (ack) => reply(ack, manager.leave(socket.id)));
  socket.on('room:settings', (p, ack) => reply(ack, manager.updateSettings(socket.id, p ?? {})));
  socket.on('room:addBot', (p, ack) => reply(ack, manager.addBot(socket.id, p?.seat)));
  socket.on('room:kick', (p, ack) => reply(ack, manager.kick(socket.id, p?.seat)));
  socket.on('room:start', (ack) => reply(ack, manager.start(socket.id)));
  socket.on('game:action', (p, ack) => reply(ack, manager.action(socket.id, p)));
  socket.on('game:playAgain', (ack) => reply(ack, manager.playAgain(socket.id)));
  socket.on('disconnect', () => manager.disconnect(socket.id));
});

setInterval(() => manager.sweep(), 60_000).unref();

http.listen(PORT, () => console.log(`Joker server listening on :${PORT}`));
