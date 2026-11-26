import type { ReactNode } from 'react';
import type { Card, Suit } from '@joker/engine';
import { rankLabel } from '@joker/engine';

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠︎', C: '♣︎', H: '♥︎', D: '♦︎' };
export const isRed = (s: Suit | null) => s === 'H' || s === 'D';

const RED = 'var(--color-suit-red)';
const BLACK = 'var(--color-suit-black)';
const GOLD = '#d9a62e';
const SKIN = '#f6d7b0';
const ROBE_BLUE = '#2b4fa8';
const SERIF = "Georgia, 'Times New Roman', serif";

export function SuitIcon({ suit, className = '' }: { suit: Suit; className?: string }) {
  return (
    <span aria-label={suit} className={`${isRed(suit) ? 'text-suit-red' : 'text-suit-black'} ${className}`}>
      {SUIT_SYMBOL[suit]}
    </span>
  );
}

/** Suit shape drawn in a 10×10 box. */
function SuitPath({ suit }: { suit: Suit }) {
  switch (suit) {
    case 'H':
      return <path d="M5 9.4C5 9.4.3 6.2.3 3.1.3 1.4 1.6.3 3 .3c1 0 1.6.6 2 1.3.4-.7 1-1.3 2-1.3 1.4 0 2.7 1.1 2.7 2.8C9.7 6.2 5 9.4 5 9.4Z" />;
    case 'D':
      return <path d="M5 .2C6.2 2 7.6 3.6 9 5 7.6 6.4 6.2 8 5 9.8 3.8 8 2.4 6.4 1 5 2.4 3.6 3.8 2 5 .2Z" />;
    case 'S':
      return (
        <path d="M5 .3S.3 3.6.3 6.2c0 1.5 1.1 2.4 2.4 2.4.9 0 1.6-.5 2-1.1-.1.9-.5 1.7-1.3 2.2h3.2c-.8-.5-1.2-1.3-1.3-2.2.4.6 1.1 1.1 2 1.1 1.3 0 2.4-.9 2.4-2.4C9.7 3.6 5 .3 5 .3Z" />
      );
    case 'C':
      return (
        <>
          <circle cx="5" cy="2.7" r="2.35" />
          <circle cx="2.55" cy="6.1" r="2.35" />
          <circle cx="7.45" cy="6.1" r="2.35" />
          <path d="M4.6 5.5 3.6 9.8h2.8L5.4 5.5Z" />
        </>
      );
  }
}

/** A suit shape centred on (x, y) with width `size`, optionally upside down. */
function Pip({ suit, x, y, size, flip = false }: { suit: Suit; x: number; y: number; size: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})${flip ? ' rotate(180)' : ''} scale(${size / 10}) translate(-5 -5)`}>
      <SuitPath suit={suit} />
    </g>
  );
}

function Star({ x, y, r }: { x: number; y: number; r: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(x + rr * Math.cos(a)).toFixed(2)},${(y + rr * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return <polygon points={pts} />;
}

// Traditional pip layouts on a 100×140 card. Pips below the middle are drawn upside down.
const L = 33;
const C = 50;
const R = 67;
const pairs = (ys: number[]) => ys.flatMap((y): [number, number][] => [[L, y], [R, y]]);
const ROW3 = [28, 70, 112];
const ROW4 = [28, 56, 84, 112];
const LAYOUTS: Record<number, [number, number][]> = {
  6: pairs(ROW3),
  7: [...pairs(ROW3), [C, 49]],
  8: [...pairs(ROW3), [C, 49], [C, 91]],
  9: [...pairs(ROW4), [C, 70]],
  10: [...pairs(ROW4), [C, 42], [C, 98]],
};

/** Rank + suit in the top-left corner, mirrored in the bottom-right. */
function Corner({ label, suit }: { label: string; suit: Suit | null }) {
  const two = label.length > 1;
  const corner = (
    <>
      <text x="12" y="23" textAnchor="middle" fontSize={two ? 20 : 23} fontWeight="800" letterSpacing={two ? -2 : 0} fontFamily={SERIF}>
        {label}
      </text>
      {suit ? <Pip suit={suit} x={12} y={34} size={12} /> : <Star x={12} y={34} r={6.5} />}
    </>
  );
  return (
    <g>
      {corner}
      <g transform="rotate(180 50 70)">{corner}</g>
    </g>
  );
}

/** Top half of a double-headed court figure (y 15..70). */
function CourtHalf({ rank, suit }: { rank: number; suit: Suit }) {
  const main = isRed(suit) ? RED : BLACK;
  const robe = isRed(suit) ? ROBE_BLUE : RED;
  let hat: ReactNode;
  if (rank === 13) {
    // King: tall crown
    hat = (
      <>
        <path d="M39.5 37 39 23l5.5 6L50 20l5.5 9L61 23l-.5 14Z" fill={GOLD} stroke={main} strokeWidth="0.8" />
        <circle cx="50" cy="31" r="1.6" fill={RED} />
      </>
    );
  } else if (rank === 12) {
    // Queen: long hair and a pearl tiara
    hat = (
      <>
        <path d="M41 36.5 42 29l4 4 4-6 4 6 4-4 1 7.5Z" fill={GOLD} stroke={main} strokeWidth="0.7" />
        {[42, 50, 58].map((x, i) => (
          <circle key={x} cx={x} cy={i === 1 ? 26.5 : 28.5} r="1.3" fill="#fff" stroke={main} strokeWidth="0.5" />
        ))}
      </>
    );
  } else {
    // Jack: soft cap with a feather
    hat = (
      <>
        <path d="M38 38c1-8 6-11 12-11s12 3 13 11Z" fill={robe} stroke={main} strokeWidth="0.8" />
        <path d="M58 30c5-6 10-7 13-5-4 1-8 4-11 8Z" fill={GOLD} stroke={main} strokeWidth="0.6" />
      </>
    );
  }
  return (
    <g>
      {rank === 12 && <path d="M37.5 46c-1-9 4-13 12.5-13s13.5 4 12.5 13l-3 9H40.5Z" fill={main} opacity="0.85" />}
      <path d="M26 70c0-9 6-15 14-16h20c8 1 14 7 14 16Z" fill={robe} stroke={main} strokeWidth="0.9" />
      <path d="M44 54h12l-6 16Z" fill={GOLD} stroke={main} strokeWidth="0.6" />
      <path d="M26 66h48" stroke={GOLD} strokeWidth="2" />
      <circle cx="50" cy="45" r="9" fill={SKIN} stroke={main} strokeWidth="0.9" />
      <circle cx="46.8" cy="44" r="0.9" fill={BLACK} />
      <circle cx="53.2" cy="44" r="0.9" fill={BLACK} />
      <path d="M47.5 49q2.5 1.6 5 0" stroke={RED} strokeWidth="0.8" fill="none" />
      {rank === 13 && <path d="M42 48q8 12 16 0-3 4-8 4t-8-4Z" fill="#8a6a3a" />}
      {hat}
      <g fill={main}>
        <Pip suit={suit} x={30} y={25} size={10} />
      </g>
    </g>
  );
}

function JesterHalf({ color }: { color: string }) {
  const other = color === RED ? ROBE_BLUE : RED;
  return (
    <g>
      <path d="M28 70c0-9 6-14 13-15h18c7 1 13 6 13 15Z" fill={other} stroke={color} strokeWidth="0.9" />
      <path d="M38 56l4 6 4-6 4 6 4-6 4 6 4-6" stroke={GOLD} strokeWidth="1.4" fill="none" />
      <circle cx="50" cy="45" r="8.5" fill={SKIN} stroke={color} strokeWidth="0.9" />
      <circle cx="47" cy="44" r="0.9" fill={BLACK} />
      <circle cx="53" cy="44" r="0.9" fill={BLACK} />
      <path d="M46.5 48.3q3.5 3 7 0" stroke={RED} strokeWidth="0.9" fill="none" />
      {/* three-pointed cap with bells */}
      <path d="M41 39 30 24l12 7 8-13 8 13 12-7-11 15Z" fill={color} />
      <path d="M50 18v19l8-6Z" fill={other} />
      {[[30, 24], [50, 18], [70, 24]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="2.2" fill={GOLD} stroke={color} strokeWidth="0.5" />
      ))}
    </g>
  );
}

/** Framed, double-headed picture card (court cards and jokers). */
function Framed({ color, half }: { color: string; half: ReactNode }) {
  return (
    <g>
      <rect x="22" y="15" width="56" height="110" rx="3" fill="#fbf3dc" stroke={color} strokeWidth="1.2" />
      {half}
      <g transform="rotate(180 50 70)">{half}</g>
      <line x1="22" y1="70" x2="78" y2="70" stroke={color} strokeWidth="0.8" />
    </g>
  );
}

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<CardSize, string> = {
  xs: 'w-7 h-10 rounded-[5px]',
  sm: 'w-11 h-16 rounded-md',
  md: 'w-[3.4rem] h-[4.9rem] sm:w-16 sm:h-[5.75rem] rounded-lg',
  lg: 'w-20 h-28 rounded-xl',
};

/** Tiny card (trump indicator): just a big rank and suit. */
function MiniFace({ card }: { card: Card }) {
  if (card.joker) {
    return (
      <svg viewBox="0 0 40 56" className="size-full" fill={card.id === 'X1' ? RED : BLACK}>
        <Star x={20} y={28} r={13} />
      </svg>
    );
  }
  const suit = card.suit!;
  const label = rankLabel(card.rank);
  const two = label.length > 1;
  return (
    <svg viewBox="0 0 40 56" className="size-full" fill={isRed(suit) ? RED : BLACK}>
      <text x="20" y="25" textAnchor="middle" fontSize={two ? 20 : 24} fontWeight="800" letterSpacing={two ? -2 : 0} fontFamily={SERIF}>
        {label}
      </text>
      <Pip suit={suit} x={20} y={40} size={17} />
    </svg>
  );
}

export function CardFace({ card, size = 'md', className = '' }: { card: Card; size?: CardSize; className?: string }) {
  const label = card.joker ? 'Joker' : `${rankLabel(card.rank)} ${card.suit}`;
  const box = `relative shrink-0 select-none overflow-hidden bg-card shadow-md ring-1 ring-black/10 ${SIZES[size]} ${className}`;
  if (size === 'xs') {
    return (
      <div className={box} aria-label={label}>
        <MiniFace card={card} />
      </div>
    );
  }
  let color: string;
  let art: ReactNode;
  if (card.joker) {
    color = card.id === 'X1' ? RED : BLACK;
    art = (
      <>
        <Framed color={color} half={<JesterHalf color={color} />} />
        <Corner label="J" suit={null} />
      </>
    );
  } else {
    const suit = card.suit!;
    color = isRed(suit) ? RED : BLACK;
    let middle: ReactNode;
    if (card.rank === 14) middle = <Pip suit={suit} x={50} y={70} size={40} />;
    else if (card.rank >= 11) middle = <Framed color={color} half={<CourtHalf rank={card.rank} suit={suit} />} />;
    else middle = LAYOUTS[card.rank]?.map(([x, y], i) => <Pip key={i} suit={suit} x={x} y={y} size={17} flip={y > 70} />);
    art = (
      <>
        {middle}
        <Corner label={rankLabel(card.rank)} suit={suit} />
      </>
    );
  }
  return (
    <div className={box} aria-label={label}>
      <svg viewBox="0 0 100 140" preserveAspectRatio="none" className="size-full" fill={color} aria-hidden>
        {art}
      </svg>
    </div>
  );
}

export function CardBack({ size = 'sm', className = '' }: { size?: CardSize; className?: string }) {
  return <div className={`card-back shrink-0 shadow ring-1 ring-white/30 ${SIZES[size]} ${className}`} />;
}
