'use client';
import { getRankings, type PlayerView } from '@joker/engine';
import { useI18n } from '@/lib/i18n';
import { request } from '@/lib/socket';
import { Button, Modal } from './ui';

const MEDAL = ['🥇', '🥈', '🥉', ''];

export function GameOver({
  game,
  isHost,
  onScores,
  onLeave,
}: {
  game: PlayerView;
  isHost: boolean;
  onScores: () => void;
  onLeave: () => void;
}) {
  const { t } = useI18n();
  const rows = getRankings(game);
  return (
    <Modal title={t('gameOver')}>
      <ol className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.seat}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 ${r.place === 1 ? 'bg-gold/20 ring-1 ring-gold/50' : 'bg-white/5'}`}
          >
            <span className="w-7 text-center text-xl">{MEDAL[r.place - 1] || r.place}</span>
            <span className={`flex-1 truncate font-medium ${r.seat === game.seat ? 'text-gold' : ''}`}>{r.name}</span>
            <span className="text-lg font-bold tabular-nums">{r.total}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-col gap-2">
        {isHost ? (
          <Button variant="primary" className="py-3 text-base" onClick={() => request('game:playAgain')}>
            {t('playAgain')}
          </Button>
        ) : (
          <p className="text-center text-sm text-white/60">{t('waitingPlayAgain')}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onScores}>{t('scores')}</Button>
          <Button variant="ghost" onClick={onLeave}>
            {t('leave')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
