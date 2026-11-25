'use client';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@joker/engine/protocol';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };

let socket: GameSocket | null = null;

export function serverUrl(): string {
  return process.env.NEXT_PUBLIC_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
}

export function getSocket(): GameSocket {
  if (!socket) socket = io(serverUrl(), { transports: ['websocket', 'polling'] });
  return socket;
}

/** Emits an event with an ack and resolves with the server's reply (or a timeout error). */
export function request<T = object>(event: keyof ClientToServerEvents, payload?: unknown, timeoutMs = 8000): Promise<Res<T>> {
  const s = getSocket() as unknown as {
    timeout(ms: number): { emit(ev: string, ...args: unknown[]): void };
  };
  return new Promise((resolve) => {
    const args = payload === undefined ? [] : [payload];
    s.timeout(timeoutMs).emit(event, ...args, (err: unknown, res: Res<T>) =>
      resolve(err ? { ok: false, error: 'timeout' } : res),
    );
  });
}
