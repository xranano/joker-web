'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPlayerId } from '@/lib/identity';
import { useI18n } from '@/lib/i18n';
import { getSocket, request } from '@/lib/socket';
import { Button, Centered, LangToggle } from '@/components/ui';
import { CardFace } from '@/components/Card';

export default function Home() {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [waking, setWaking] = useState(false);

  // Connect right away so a sleeping free-tier server starts waking up.
  useEffect(() => {
    const s = getSocket();
    if (s.connected) return;
    const slow = setTimeout(() => setWaking(true), 1500);
    const onConnect = () => {
      clearTimeout(slow);
      setWaking(false);
    };
    s.on('connect', onConnect);
    return () => {
      clearTimeout(slow);
      s.off('connect', onConnect);
    };
  }, []);

  const create = async () => {
    setBusy(true);
    setError('');
    const r = await request<{ code: string }>('room:create', { playerId: getPlayerId() }, 70_000);
    if (r.ok) router.push(`/room/${r.code}`);
    else {
      setError(r.error === 'timeout' ? t('serverDown') : t('genericError'));
      setBusy(false);
    }
  };

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length === 6) router.push(`/room/${c}`);
  };

  return (
    <Centered>
      <LangToggle className="fixed right-4 top-4" />
      <div className="mb-2 flex -space-x-5" aria-hidden>
        <CardFace card={{ id: 'AH', suit: 'H', rank: 14, joker: false }} size="lg" className="-rotate-12" />
        <CardFace card={{ id: 'X1', suit: null, rank: 0, joker: true }} size="lg" className="z-10 -translate-y-2" />
        <CardFace card={{ id: 'AS', suit: 'S', rank: 14, joker: false }} size="lg" className="rotate-12" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t('appName')}</h1>
      <p className="max-w-xs text-white/70">{t('tagline')}</p>
      <Button variant="primary" className="mt-4 w-full max-w-xs py-3.5 text-base" onClick={create} disabled={busy}>
        {busy ? t('creating') : t('createGame')}
      </Button>
      {waking && !error && (
        <p className="max-w-xs text-sm text-white/60" role="status">
          {t('wakingUp')} {t('wakingUpHint')}
        </p>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
      <form onSubmit={go} className="mt-6 flex w-full max-w-xs flex-col gap-2">
        <label htmlFor="code" className="text-xs uppercase tracking-wider text-white/50">
          {t('orJoin')}
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder={t('codePlaceholder')}
            autoCapitalize="characters"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2.5 text-center font-mono text-base tracking-[0.3em] outline-none ring-1 ring-white/15 placeholder:tracking-normal placeholder:text-white/30 focus:ring-gold"
          />
          <Button type="submit" disabled={code.length !== 6}>
            {t('go')}
          </Button>
        </div>
      </form>
    </Centered>
  );
}
