'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getLegalMoves, type CompletedTrick, type PlayerView, type TrickPlay } from '@joker/engine';
import type { ActionInput, PublicSeat, RoomSnapshot } from '@joker/engine/protocol';
import { useLeave } from '@/lib/actions';
import { useI18n } from '@/lib/i18n';
import { request } from '@/lib/socket';
import { CardBack, CardFace, SUIT_SYMBOL, SuitIcon } from './Card';
import { GameOver } from './GameOver';
import { BidPanel, JokerModal, TrumpPanel } from './panels';
import { Scoresheet } from './Scoresheet';
import { LangToggle } from './ui';

const TRICK_HOLD_MS = 1600;

/** Keeps a just-finished trick on the table for a moment before clearing it. */
function useDisplayedTrick(game: PlayerView): { plays: TrickPlay[]; winner: number | null } {
  const [held, setHeld] = useState<CompletedTrick | null>(null);
  const lastKey = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lt = game.lastTrick;
  const key = lt ? `${game.handIndex}:${lt.plays.map((p) => p.card.id).join(',')}` : '';
  useEffect(() => {
    if (lastKey.current === null) {
      lastKey.current = key; // don't replay an old trick after a refresh
      return;
    }
    if (key && key !== lastKey.current && lt) {
      lastKey.current = key;
      setHeld(lt);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setHeld(null), TRICK_HOLD_MS);
    }
  }, [key, lt]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  if (game.trick.plays.length > 0 || !held) return { plays: game.trick.plays, winner: null };
  return { plays: held.plays, winner: held.winner };
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function useCanHover() {
  const [can, setCan] = useState(true);
  useEffect(() => setCan(window.matchMedia('(hover: hover) and (pointer: fine)').matches), []);
  return can;
}

function TimerBar({ fraction }: { fraction: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/15" aria-hidden>
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-linear ${fraction < 0.25 ? 'bg-red-400' : 'bg-gold'}`}
        style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
      />
    </div>
  );
}

function PlayerBadge({
  name,
  seat,
  game,
  info,
  isTurn,
  timer,
  isMe,
  className = '',
}: {
  name: string;
  seat: number;
  game: PlayerView;
  info: PublicSeat | null;
  isTurn: boolean;
  timer: number | null;
  isMe?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const bid = game.bids[seat];
  const took = game.tricks[seat];
  const status = info?.autoPlay ? t('autoPlay') : info && !info.connected ? t('offline') : null;
  const made = bid !== null && took === bid;
  const over = bid !== null && took > bid;
  return (
    <div
      className={`relative flex min-w-0 flex-col gap-1 rounded-xl px-2.5 py-1.5 transition ${
        isTurn ? 'bg-gold/25 ring-2 ring-gold shadow-[0_0_20px_rgba(244,194,77,0.35)]' : 'bg-black/30 ring-1 ring-white/10'
      } ${className}`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={`size-2 shrink-0 rounded-full ${info?.connected === false ? 'bg-white/30' : 'bg-emerald-400'}`}
          title={info?.connected === false ? t('offline') : 'online'}
        />
        <span className="truncate text-sm font-semibold">
          {info?.isBot && '🤖 '}
          {name}
          {isMe && <span className="font-normal text-white/50"> ({t('you')})</span>}
        </span>
        {game.dealer === seat && (
          <span title={t('dealer')} className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-white text-[10px] font-bold text-night shadow">
            D
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs tabular-nums text-white/80">
        <span>
          {t('bid')} <b className="text-white">{bid ?? '–'}</b>
        </span>
        <span>
          {t('took')}{' '}
          <b className={made ? 'text-emerald-300' : over ? 'text-orange-300' : 'text-white'}>{took}</b>
        </span>
      </div>
      {status && <span className="text-[10px] text-amber-200/90">{status}</span>}
      {timer !== null && <TimerBar fraction={timer} />}
    </div>
  );
}

function TrumpBadge({ game }: { game: PlayerView }) {
  const { t } = useI18n();
  if (game.phase === 'trump') {
    return <span className="rounded-lg bg-white/10 px-2 py-1 text-xs text-white/70">{t('trump')}: ?</span>;
  }
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white/10 py-1 pl-2 pr-1 text-xs" aria-label={t('trump')}>
      <span className="text-white/70">{t('trump')}</span>
      {game.trumpCard ? (
        <CardFace card={game.trumpCard} size="xs" />
      ) : game.trump ? (
        <span className="grid h-7 w-6 place-items-center rounded bg-card text-base">
          <SuitIcon suit={game.trump} />
        </span>
      ) : null}
      {!game.trump && <span className="pr-1 font-semibold">{t('noTrump')}</span>}
    </div>
  );
}

const TRICK_POS = ['col-start-2 row-start-3', 'col-start-1 row-start-2', 'col-start-2 row-start-1', 'col-start-3 row-start-2'];

export function Game({ snap, clockOffset }: { snap: RoomSnapshot; clockOffset: number }) {
  const { t } = useI18n();
  const leave = useLeave();
  const game = snap.game!;
  const mySeat = snap.you.seat;
  const base = mySeat ?? 0;
  const myId = mySeat !== null ? game.players[mySeat].id : null;
  const legal = useMemo(() => (myId ? getLegalMoves(game, myId) : []), [game, myId]);
  const myTurn = mySeat !== null && game.turn === mySeat;
  const playable = useMemo(() => new Set(legal.flatMap((a) => (a.type === 'play' ? [a.cardId] : []))), [legal]);
  const trick = useDisplayedTrick(game);
  const canHover = useCanHover();
  const [selected, setSelected] = useState<string | null>(null);
  const [jokerCard, setJokerCard] = useState<string | null>(null);
  const [scoresOpen, setScoresOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const now = useNow(snap.turnDeadline !== null);

  // Toast with my score when a hand ends
  const historyLen = useRef(game.history.length);
  useEffect(() => {
    if (game.history.length > historyLen.current && mySeat !== null) {
      const rec = game.history[game.history.length - 1];
      setToast(t('handDone', { n: rec.handIndex + 1, p: rec.results[mySeat].points }));
    }
    historyLen.current = game.history.length;
  }, [game.history, mySeat, t]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!myTurn) {
      setSelected(null);
      setJokerCard(null);
    }
  }, [myTurn]);

  const send = async (input: ActionInput) => {
    setSelected(null);
    setJokerCard(null);
    const r = await request('game:action', input);
    if (!r.ok) {
      setToast(t('genericError'));
    }
  };

  const onCard = (cardId: string, joker: boolean) => {
    if (!myTurn || game.phase !== 'playing' || !playable.has(cardId)) return;
    if (joker) return setJokerCard(cardId);
    if (canHover || selected === cardId) send({ type: 'play', cardId });
    else setSelected(cardId);
  };

  const timerFraction = (seat: number) => {
    if (snap.turnDeadline === null || game.turn !== seat) return null;
    const total = snap.settings.turnTimer * 1000;
    return (snap.turnDeadline - (now + clockOffset)) / total;
  };

  const rel = (seat: number) => (seat - base + 4) % 4;
  const seatAt = (r: number) => (base + r) % 4;
  const turnName = game.turn >= 0 ? game.players[game.turn].name : '';
  const isLead = game.trick.plays.length === 0;

  const opponent = (r: number, className: string) => {
    const seat = seatAt(r);
    return (
      <div className={`absolute z-10 flex flex-col items-center gap-1 ${className}`}>
        <PlayerBadge
          name={game.players[seat].name}
          seat={seat}
          game={game}
          info={snap.seats[seat]}
          isTurn={game.turn === seat}
          timer={timerFraction(seat)}
          className="w-[6.5rem] sm:w-36"
        />
        <div className="flex -space-x-5" aria-label={`${game.handCounts[seat]} ${t('cards')}`}>
          {Array.from({ length: Math.min(game.handCounts[seat], 9) }, (_, i) => (
            <CardBack key={i} size="xs" />
          ))}
        </div>
      </div>
    );
  };

  let centerText: string | null = null;
  if (game.phase === 'trump' && !myTurn) centerText = t('choosingTrump', { name: turnName });
  else if (game.phase === 'bidding' && !myTurn) centerText = t('waitingFor', { name: turnName });
  else if (game.phase === 'playing' && trick.plays.length === 0) centerText = myTurn ? t('yourTurn') : t('waitingFor', { name: turnName });

  return (
    <div className="flex h-dvh flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      {/* top bar */}
      <header className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            <span className="hidden sm:inline">{t('hand')} </span>
            {Math.min(game.handIndex + 1, game.schedule.length)}/{game.schedule.length}
            <span className="font-normal text-white/60">
              {' '}
              · {game.handSize} {t('cards')}
            </span>
          </p>
          <p className="hidden font-mono text-[11px] tracking-widest text-white/40 sm:block">{snap.code}</p>
        </div>
        <TrumpBadge game={game} />
        <button
          onClick={() => setScoresOpen(true)}
          className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/15"
        >
          {t('scores')}
        </button>
        <LangToggle />
        <button onClick={leave} aria-label={t('leave')} className="rounded-lg px-2 py-1.5 text-white/60 hover:bg-white/10 hover:text-white">
          ✕
        </button>
      </header>

      {/* table */}
      <section className="felt relative mx-2 min-h-0 flex-1 overflow-hidden rounded-[1.75rem] shadow-inner ring-1 ring-black/40">
        {opponent(2, 'left-1/2 top-2 -translate-x-1/2')}
        {opponent(1, 'left-1.5 top-[42%] -translate-y-1/2')}
        {opponent(3, 'right-1.5 top-[42%] -translate-y-1/2')}

        <div className="absolute inset-0 grid place-items-center pt-6">
          <div className="grid grid-cols-[repeat(3,auto)] grid-rows-[repeat(3,auto)] place-items-center gap-1">
            {trick.plays.map((p) => {
              const won = trick.winner === p.seat;
              return (
                <div key={p.card.id} className={`animate-deal relative flex flex-col items-center ${TRICK_POS[rel(p.seat)]}`}>
                  <CardFace card={p.card} size="sm" className={won ? 'ring-4 ring-gold' : ''} />
                  {p.joker && (
                    <span className="absolute -bottom-2 rounded-full bg-night px-1.5 text-[10px] font-semibold text-gold ring-1 ring-gold/50">
                      {p.joker.mode === 'high' ? '▲' : '▼'}
                      {p.joker.suit && ` ${SUIT_SYMBOL[p.joker.suit]}`}
                    </span>
                  )}
                </div>
              );
            })}
            {trick.plays.length === 0 && centerText && (
              <p className="col-span-3 row-start-2 max-w-[11rem] rounded-full bg-black/25 px-4 py-2 text-center text-sm text-white/85">
                {centerText}
              </p>
            )}
          </div>
          {trick.winner !== null && (
            <p className="absolute bottom-3 rounded-full bg-black/40 px-3 py-1 text-xs text-gold">
              {t('wonTrick', { name: game.players[trick.winner].name })}
            </p>
          )}
        </div>

        {myTurn && game.phase === 'bidding' && (
          <BidPanel handSize={game.handSize} legal={legal} onBid={(bid) => send({ type: 'bid', bid })} />
        )}
        {myTurn && game.phase === 'trump' && <TrumpPanel onChoose={(suit) => send({ type: 'chooseTrump', suit })} />}
      </section>

      {/* me */}
      {mySeat !== null && (
        <div className="mx-auto mt-2 w-full max-w-xs px-3">
          <PlayerBadge
            name={game.players[mySeat].name}
            seat={mySeat}
            game={game}
            info={snap.seats[mySeat]}
            isTurn={myTurn}
            timer={timerFraction(mySeat)}
            isMe
          />
        </div>
      )}

      {/* hand */}
      <div className="flex min-h-[6.75rem] items-end justify-center px-2 pb-2 pt-3 sm:min-h-[7.75rem]">
        <div className="flex">
          {game.hand.map((card, i) => {
            const canPlay = myTurn && game.phase === 'playing' && playable.has(card.id);
            const dim = myTurn && game.phase === 'playing' && !canPlay;
            const isSel = selected === card.id;
            return (
              <button
                key={card.id}
                onClick={() => onCard(card.id, card.joker)}
                disabled={!canPlay}
                aria-label={card.joker ? 'Joker' : card.id}
                style={{ zIndex: i }}
                className={`relative transition-transform duration-150 ${i > 0 ? '-ml-5 sm:-ml-4' : ''} ${
                  canPlay ? 'hover:-translate-y-3 focus-visible:-translate-y-3' : ''
                } ${isSel ? '-translate-y-4' : ''} disabled:cursor-default`}
              >
                <CardFace
                  card={card}
                  size="md"
                  className={`${dim ? 'brightness-[0.55] grayscale-[0.6]' : ''} ${isSel ? 'ring-4 ring-gold' : canPlay ? 'ring-2 ring-gold/70' : ''}`}
                />
              </button>
            );
          })}
        </div>
      </div>
      {selected && !canHover && (
        <p className="pb-2 text-center text-xs text-white/60">
          {t('tapAgain')}
        </p>
      )}

      {toast && (
        <div className="animate-toast fixed bottom-44 left-1/2 z-[70] whitespace-nowrap sm:bottom-48 -translate-x-1/2 rounded-full bg-night/95 px-4 py-2 text-sm shadow-xl ring-1 ring-gold/40">
          {toast}
        </div>
      )}
      {jokerCard && <JokerModal cardId={jokerCard} isLead={isLead} onPlay={send} onClose={() => setJokerCard(null)} />}
      {scoresOpen && <Scoresheet game={game} mySeat={mySeat} onClose={() => setScoresOpen(false)} />}
      {snap.status === 'finished' && !scoresOpen && (
        <GameOver game={game} isHost={snap.you.isHost} onScores={() => setScoresOpen(true)} onLeave={leave} />
      )}
    </div>
  );
}
