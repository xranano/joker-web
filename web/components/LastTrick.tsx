'use client';
import type { CompletedTrick, PlayerView } from '@joker/engine';
import { useI18n } from '@/lib/i18n';
import { CardFace, SUIT_SYMBOL } from './Card';
import { Button, Modal } from './ui';

/** The last finished trick: its 4 cards in play order, who led and who took it. */
export function LastTrick({
  trick,
  game,
  mySeat,
  onClose,
}: {
  trick: CompletedTrick;
  game: PlayerView;
  mySeat: number | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal title={t('lastTrick')} onClose={onClose}>
      <p className="mb-3 text-sm text-gold">{t('wonTrick', { name: game.players[trick.winner].name })}</p>
      <div className="grid grid-cols-4 gap-2">
        {trick.plays.map((p, i) => {
          const won = p.seat === trick.winner;
          return (
            <div key={p.card.id} className="relative flex min-w-0 flex-col items-center gap-1.5 pt-2.5">
              {i === 0 && (
                <span className="absolute top-0 z-10 whitespace-nowrap rounded-full bg-gold px-1.5 text-[10px] font-bold leading-4 text-night">
                  {t('led')} ▸
                </span>
              )}
              <div className="relative">
                <CardFace card={p.card} size="md" className={won ? 'ring-4 ring-gold' : ''} />
                {p.joker && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-night px-1.5 text-[11px] font-semibold text-gold ring-1 ring-gold/50">
                    {p.joker.mode === 'high' ? '▲' : '▼'}
                    {p.joker.suit && ` ${SUIT_SYMBOL[p.joker.suit]}`}
                  </span>
                )}
              </div>
              <span
                className={`w-full truncate text-center text-xs ${p.seat === mySeat ? 'text-gold' : won ? 'font-semibold text-white' : 'text-white/70'}`}
              >
                {game.players[p.seat].name}
              </span>
            </div>
          );
        })}
      </div>
      <Button variant="ghost" className="mt-4 w-full" onClick={onClose}>
        {t('close')}
      </Button>
    </Modal>
  );
}
