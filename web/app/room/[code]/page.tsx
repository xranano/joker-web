'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useRoom } from '@/lib/useRoom';
import { Centered, LangToggle } from '@/components/ui';
import { JoinForm } from '@/components/JoinForm';
import { Lobby } from '@/components/Lobby';
import { Game } from '@/components/Game';

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? '').toUpperCase();
  const { t } = useI18n();
  const room = useRoom(code);
  const { snap, status } = room;

  const message = (title: string, hint?: string) => (
    <Centered>
      <LangToggle className="fixed right-4 top-4" />
      <h1 className="text-2xl font-semibold">{title}</h1>
      {hint && <p className="max-w-xs text-white/70">{hint}</p>}
      <Link href="/" className="mt-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm hover:bg-white/15">
        {t('backHome')}
      </Link>
    </Centered>
  );

  switch (status) {
    case 'connecting':
      return message(t('connecting'));
    case 'serverDown':
      // socket.io keeps retrying; this clears as soon as the server answers
      return message(t('wakingUp'), t('wakingUpHint'));
    case 'notFound':
      return message(t('notFound'), t('notFoundHint'));
    case 'inProgress':
      return message(t('inProgress'), t('inProgressHint'));
    case 'kicked':
      return message(t('kicked'));
    case 'needName':
      return <JoinForm code={code} onJoin={room.join} />;
  }
  if (!snap) return message(t('connecting'));
  const banner = !room.connected && (
    <div className="fixed inset-x-0 top-0 z-[60] bg-amber-500 py-1.5 text-center text-sm font-medium text-night">{t('reconnecting')}</div>
  );
  return (
    <>
      {banner}
      {snap.status === 'lobby' ? <Lobby snap={snap} /> : <Game snap={snap} clockOffset={room.clockOffset} />}
    </>
  );
}
