import type { Card, Suit } from '@joker/engine';
import { rankLabel } from '@joker/engine';

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠︎', C: '♣︎', H: '♥︎', D: '♦︎' };
export const isRed = (s: Suit | null) => s === 'H' || s === 'D';

export function SuitIcon({ suit, className = '' }: { suit: Suit; className?: string }) {
  return (
    <span aria-label={suit} className={`${isRed(suit) ? 'text-suit-red' : 'text-suit-black'} ${className}`}>
      {SUIT_SYMBOL[suit]}
    </span>
  );
}

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<CardSize, { box: string; corner: string; pip: string }> = {
  xs: { box: 'w-7 h-10 rounded-[5px]', corner: 'text-[9px]', pip: 'text-base' },
  sm: { box: 'w-11 h-16 rounded-md', corner: 'text-[11px]', pip: 'text-2xl' },
  md: { box: 'w-[3.4rem] h-[4.9rem] sm:w-16 sm:h-[5.75rem] rounded-lg', corner: 'text-xs sm:text-sm', pip: 'text-3xl sm:text-4xl' },
  lg: { box: 'w-20 h-28 rounded-xl', corner: 'text-base', pip: 'text-5xl' },
};

export function CardFace({ card, size = 'md', className = '' }: { card: Card; size?: CardSize; className?: string }) {
  const s = SIZES[size];
  if (card.joker) {
    const red = card.id === 'X1';
    return (
      <div
        className={`relative flex shrink-0 select-none flex-col items-center justify-center bg-card shadow-md ring-1 ring-black/10 ${s.box} ${className}`}
        aria-label="Joker"
      >
        <span className={`absolute left-1 top-0.5 font-bold leading-none ${s.corner} ${red ? 'text-suit-red' : 'text-suit-black'}`}>
          J
        </span>
        <span className={`${s.pip} leading-none ${red ? 'text-suit-red' : 'text-suit-black'}`}>★</span>
        {size !== 'xs' && (
          <span className={`mt-0.5 text-[8px] font-bold tracking-widest sm:text-[9px] ${red ? 'text-suit-red' : 'text-suit-black'}`}>
            JOKER
          </span>
        )}
      </div>
    );
  }
  const suit = card.suit!;
  const color = isRed(suit) ? 'text-suit-red' : 'text-suit-black';
  return (
    <div
      className={`relative flex shrink-0 select-none items-center justify-center bg-card shadow-md ring-1 ring-black/10 ${s.box} ${color} ${className}`}
      aria-label={`${rankLabel(card.rank)} ${suit}`}
    >
      <span className={`absolute left-1 top-0.5 flex flex-col items-center font-bold leading-[1.05] ${s.corner}`}>
        <span>{rankLabel(card.rank)}</span>
        <span>{SUIT_SYMBOL[suit]}</span>
      </span>
      {size !== 'xs' && (
        <span className={`absolute bottom-0.5 right-1 flex rotate-180 flex-col items-center font-bold leading-[1.05] ${s.corner}`}>
          <span>{rankLabel(card.rank)}</span>
          <span>{SUIT_SYMBOL[suit]}</span>
        </span>
      )}
      <span className={`${s.pip} leading-none`}>{SUIT_SYMBOL[suit]}</span>
    </div>
  );
}

export function CardBack({ size = 'sm', className = '' }: { size?: CardSize; className?: string }) {
  return <div className={`card-back shrink-0 shadow ring-1 ring-white/30 ${SIZES[size].box} ${className}`} />;
}
