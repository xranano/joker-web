'use client';
import { useEffect, useState } from 'react';
import type { PlayerView } from '@joker/engine';
import { useI18n } from '@/lib/i18n';
import { SuitIcon } from './Card';

const KEY = 'joker.pulkaMini.open';

/** Small, collapsible table of the current pulka's results, overlaid on the table (wide screens). */
export function PulkaMini({ game, mySeat, className = '' }: { game: PlayerView; mySeat: number | null; className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === '0') setOpen(false);
    } catch {}
  }, []);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(KEY, o ? '0' : '1');
      } catch {}
      return !o;
    });
  };

  const pulka = game.schedule[Math.min(game.handIndex, game.schedule.length - 1)].pulka;
  const done = game.history.filter((h) => h.pulka === pulka);
  const sums = game.players.map((_, seat) => done.reduce((a, h) => a + h.results[seat].points + h.results[seat].bonus, 0));

  return (
    <div className={`w-60 rounded-xl bg-black/35 text-xs shadow-lg ring-1 ring-white/10 backdrop-blur-sm ${className}`}>
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-2.5 py-1.5 font-semibold text-gold"
      >
        {t('pulka', { n: pulka + 1 })}
        <span className="text-white/60">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <table className="mb-1.5 w-full table-fixed tabular-nums">
          <thead>
            <tr className="text-[10px] text-white/55">
              <th className="w-7" />
              {game.players.map((p, seat) => (
                <th key={p.id} className={`truncate px-0.5 pb-0.5 text-center font-semibold ${seat === mySeat ? 'text-gold' : ''}`}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {done.map((h) => (
              <tr key={h.handIndex} className="border-t border-white/5">
                <td className="whitespace-nowrap py-0.5 pl-2 text-[10px] text-white/50">
                  {h.handSize}
                  {h.trump ? <SuitIcon suit={h.trump} className="ml-0.5 !text-white/60" /> : <span className="ml-0.5">–</span>}
                </td>
                {h.results.map((r, seat) => (
                  <td
                    key={seat}
                    title={`${t('bid')} ${r.bid} · ${t('took')} ${r.tricks}`}
                    className={`py-0.5 text-center font-semibold ${
                      r.khishti ? 'bg-red-500/25 text-red-300' : r.bid === r.tricks ? 'text-emerald-300' : 'text-white/80'
                    }`}
                  >
                    {r.points}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-white/20">
              <td className="py-1 pl-2 text-white/60">Σ</td>
              {sums.map((s, seat) => (
                <td key={seat} className={`py-1 text-center font-bold ${seat === mySeat ? 'text-gold' : 'text-white'}`}>
                  {done.length ? s : '–'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
