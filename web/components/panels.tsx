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

/** Sum of the bids made so far and how it compares to the hand size. */
export function bidSummary(bids: (number | null)[], handSize: number) {
  const sum = bids.reduce<number>((a, b) => a + (b ?? 0), 0);
  const done = bids.every((b) => b !== null);
  const diff = handSize - sum;
  // all bid: fewer bids than cards = შეტენვა (under), more = წაგლეჯვა (over)
  const kind: 'under' | 'over' | null = done && diff !== 0 ? (diff > 0 ? 'under' : 'over') : null;
  return { sum, done, diff, kind };
}

/** "Bids 3 of 5 · 2 left to fill" while bidding; "შეტენვა 2" / "წაგლეჯვა 1" once everyone has bid. */
export function BidStatus({
  bids,
  handSize,
  row = false,
  className = '',
}: {
  bids: (number | null)[];
  handSize: number;
  row?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const { sum, diff, kind } = bidSummary(bids, handSize);
  if (kind) {
    return (
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
          kind === 'under' ? 'bg-sky-400/20 text-sky-200 ring-1 ring-sky-300/40' : 'bg-orange-400/20 text-orange-200 ring-1 ring-orange-300/40'
        } ${className}`}
      >
        {t(kind, { n: Math.abs(diff) })}
      </span>
    );
  }
  return (
    <span className={`flex rounded-xl px-2.5 py-1 text-[11px] leading-tight text-white/80 ${row ? 'items-center gap-2 bg-white/5' : 'flex-col bg-black/30'} ${className}`}>
      <span>{t('bidsSum', { s: sum, n: handSize })}</span>
      <b className={diff < 0 ? 'text-orange-200' : 'text-gold'}>{diff < 0 ? t('over', { n: -diff }) : t('toFill', { n: diff })}</b>
    </span>
  );
}

const panel = 'animate-deal absolute inset-x-2 bottom-2 z-20 mx-auto max-w-sm rounded-2xl bg-night/90 p-4 shadow-2xl ring-1 ring-white/15 backdrop-blur';

export function BidPanel({
  handSize,
  bids,
  legal,
  onBid,
}: {
  handSize: number;
  bids: (number | null)[];
  legal: Action[];
  onBid: (bid: number) => void;
}) {
  const { t } = useI18n();
  const allowed = new Set(legal.flatMap((a) => (a.type === 'bid' ? [a.bid] : [])));
  const banned = Array.from({ length: handSize + 1 }, (_, i) => i).find((i) => !allowed.has(i));
  return (
    <div className={panel} role="dialog" aria-label={t('bidTitle')}>
      <p className="text-center font-semibold">{t('bidTitle')}</p>
      <BidStatus bids={bids} handSize={handSize} row className="mx-auto mb-3 mt-1.5 w-fit" />
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
