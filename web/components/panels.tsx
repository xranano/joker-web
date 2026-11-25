'use client';
import { SUITS, type Action, type Suit } from '@joker/engine';
import type { ActionInput } from '@joker/engine/protocol';
import { useI18n } from '@/lib/i18n';
import { SUIT_SYMBOL, isRed } from './Card';
import { Button, Modal } from './ui';

function SuitButton({ suit, onClick, label }: { suit: Suit; onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label ?? suit}
      className={`grid aspect-square place-items-center rounded-xl bg-card text-3xl shadow ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 ${
        isRed(suit) ? 'text-suit-red' : 'text-suit-black'
      }`}
    >
      {SUIT_SYMBOL[suit]}
    </button>
  );
}

const panel = 'animate-deal absolute inset-x-2 bottom-2 z-20 mx-auto max-w-sm rounded-2xl bg-night/90 p-4 shadow-2xl ring-1 ring-white/15 backdrop-blur';

export function BidPanel({
  handSize,
  legal,
  onBid,
}: {
  handSize: number;
  legal: Action[];
  onBid: (bid: number) => void;
}) {
  const { t } = useI18n();
  const allowed = new Set(legal.flatMap((a) => (a.type === 'bid' ? [a.bid] : [])));
  const banned = Array.from({ length: handSize + 1 }, (_, i) => i).find((i) => !allowed.has(i));
  return (
    <div className={panel} role="dialog" aria-label={t('bidTitle')}>
      <p className="mb-3 text-center font-semibold">{t('bidTitle')}</p>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: handSize + 1 }, (_, n) => (
          <button
            key={n}
            disabled={!allowed.has(n)}
            onClick={() => onBid(n)}
            className="rounded-xl bg-white/10 py-3 text-lg font-semibold transition enabled:hover:bg-gold enabled:hover:text-night disabled:text-white/25 disabled:line-through"
          >
            {n}
          </button>
        ))}
      </div>
      {banned !== undefined && <p className="mt-3 text-center text-xs text-white/60">{t('dealerBan', { n: banned })}</p>}
    </div>
  );
}

export function TrumpPanel({ onChoose }: { onChoose: (suit: Suit | null) => void }) {
  const { t } = useI18n();
  return (
    <div className={panel} role="dialog" aria-label={t('chooseTrump')}>
      <p className="text-center font-semibold">{t('chooseTrump')}</p>
      <p className="mb-3 text-center text-xs text-white/60">{t('chooseTrumpHint')}</p>
      <div className="grid grid-cols-4 gap-2">
        {SUITS.map((s) => (
          <SuitButton key={s} suit={s} onClick={() => onChoose(s)} />
        ))}
      </div>
      <Button className="mt-2 w-full" onClick={() => onChoose(null)}>
        {t('noTrump')}
      </Button>
    </div>
  );
}

export function JokerModal({
  cardId,
  isLead,
  onPlay,
  onClose,
}: {
  cardId: string;
  isLead: boolean;
  onPlay: (a: ActionInput) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal title={t('jokerTitle')} onClose={onClose}>
      {isLead ? (
        <div className="flex flex-col gap-4">
          {(['high', 'low'] as const).map((mode) => (
            <div key={mode}>
              <p className="mb-2 text-sm text-white/75">{mode === 'high' ? t('jokerLeadHigh') : t('jokerLeadLow')}</p>
              <div className="grid grid-cols-4 gap-2">
                {SUITS.map((s) => (
                  <SuitButton
                    key={s}
                    suit={s}
                    label={`${t(mode)} ${s}`}
                    onClick={() => onPlay({ type: 'play', cardId, joker: { mode, suit: s } })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {(['high', 'low'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onPlay({ type: 'play', cardId, joker: { mode } })}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-4 transition ${
                mode === 'high' ? 'bg-gold text-night hover:brightness-105' : 'bg-white/10 hover:bg-white/15'
              }`}
            >
              <span className="text-2xl">{mode === 'high' ? '▲' : '▼'}</span>
              <span className="font-semibold">{t(mode)}</span>
              <span className="text-xs opacity-75">{mode === 'high' ? t('jokerHighHint') : t('jokerLowHint')}</span>
            </button>
          ))}
        </div>
      )}
      <Button variant="ghost" className="mt-4 w-full" onClick={onClose}>
        {t('cancel')}
      </Button>
    </Modal>
  );
}
