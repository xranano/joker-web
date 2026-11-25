'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomSnapshot } from '@joker/engine/protocol';
import { getPlayerId, saveName } from './identity';
import { getSocket, request } from './socket';

export type RoomStatus = 'connecting' | 'needName' | 'joined' | 'inProgress' | 'notFound' | 'kicked' | 'serverDown';

export function useRoom(code: string) {
  const [snap, setSnap] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [connected, setConnected] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const s = getSocket();
    const playerId = getPlayerId();

    const probe = async () => {
      // No name: reconnects if we already have a seat, otherwise tells us what to show.
      const r = await request('room:join', { code, playerId });
      if (r.ok) return setStatus('joined');
      if (statusRef.current === 'kicked') return;
      switch (r.error) {
        case 'needName':
          return setStatus('needName');
        case 'full':
        case 'inProgress':
          return setStatus('inProgress');
        case 'kicked':
          return setStatus('kicked');
        case 'timeout':
          return; // will retry on reconnect
        default:
          return setStatus('notFound');
      }
    };
    const onConnect = () => {
      setConnected(true);
      probe();
    };
    const onDisconnect = () => setConnected(false);
    const onError = () => {
      if (statusRef.current === 'connecting') setStatus('serverDown');
    };
    const onState = (next: RoomSnapshot) => {
      setSnap(next);
      setClockOffset(next.serverNow - Date.now());
    };
    const onKicked = () => {
      setStatus('kicked');
      setSnap(null);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onError);
    s.on('room:state', onState);
    s.on('room:kicked', onKicked);
    if (s.connected) onConnect();
    else s.connect();
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onError);
      s.off('room:state', onState);
      s.off('room:kicked', onKicked);
    };
  }, [code]);

  const join = useCallback(
    async (name: string) => {
      const r = await request('room:join', { code, playerId: getPlayerId(), name });
      if (r.ok) {
        saveName(name.trim());
        setStatus('joined');
        return null;
      }
      if (r.error === 'full' || r.error === 'inProgress') setStatus('inProgress');
      return r.error;
    },
    [code],
  );

  return { snap, status, connected, clockOffset, join };
}
