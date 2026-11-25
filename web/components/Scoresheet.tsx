'use client';
import { Fragment } from 'react';
import type { PlayerView } from '@joker/engine';
import { useI18n } from '@/lib/i18n';
import { SuitIcon } from './Card';
import { Modal } from './ui';

export function Scoresheet({ game, mySeat, onClose }: { game: PlayerView; mySeat: number | null; onClose: () => void }) {
  const { t } = useI18n();
  const players = game.players;
  const pulkas = [...new Set(game.schedule.map((h) => h.pulka))];
  return (
    <Modal title={t('scores')} onClose={onClose}>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[22rem] border-separate border-spacing-0 text-sm tabular-nums">
          <thead className="sticky top-0 bg-[#13392b]">
            <tr className="text-xs text-white/60">
              <th className="py-2 pr-2 text-left font-normal">#</th>
              {players.map((p, seat) => (
                <th key={p.id} className={`px-1 py-2 text-center font-semibold ${seat === mySeat ? 'text-gold' : 'text-white/85'}`}>
                  <span className="block max-w-[5.5rem] truncate">{p.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pulkas.map((pulka) => {
              const rows = game.schedule.map((h, i) => ({ ...h, i })).filter((h) => h.pulka === pulka);
              const done = game.history.filter((h) => h.pulka === pulka);
              const subtotal = players.map((_, seat) => done.reduce((a, h) => a + h.results[seat].points + h.results[seat].bonus, 0));
              const bonuses = players.map((_, seat) => done.reduce((a, h) => a + h.results[seat].bonus, 0));
              return (
                <Fragment key={pulka}>
                  {rows.map((row) => {
                    const rec = game.history[row.i];
                    const current = row.i === game.handIndex && game.phase !== 'gameOver';
                    return (
                      <tr key={row.i} className={current ? 'bg-gold/10' : ''}>
                        <td className="whitespace-nowrap border-b border-white/5 py-1.5 pr-2 text-xs text-white/55">
                          <span className="inline-block w-5 text-right">{row.size}</span>
                          {rec && (
                            <span className="ml-1 inline-block w-3 text-center">
                              {rec.trump ? <SuitIcon suit={rec.trump} className="!text-white/70" /> : '–'}
                            </span>
                          )}
                        </td>
                        {players.map((p, seat) => {
                          const r = rec?.results[seat];
                          if (!r) {
                            const bid = current ? game.bids[seat] : null;
                            return (
                              <td key={p.id} className="border-b border-white/5 px-1 py-1.5 text-center text-white/35">
                                {bid ?? ''}
                              </td>
                            );
                          }
                          const exact = r.bid === r.tricks;
                          return (
                            <td
                              key={p.id}
                              className={`border-b border-white/5 px-1 py-1.5 text-center ${r.khishti ? 'bg-red-500/25' : ''}`}
                              title={`${t('bid')} ${r.bid} · ${t('took')} ${r.tricks}`}
                            >
                              <span className="mr-1 text-[10px] text-white/45">
                                {r.bid}/{r.tricks}
                              </span>
                              <span className={`font-semibold ${r.khishti ? 'text-red-300' : exact ? 'text-emerald-300' : 'text-white/80'}`}>
                                {r.points}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr className="bg-white/5 text-xs">
                    <td className="py-1.5 pr-2 font-semibold text-white/70">{t('pulka', { n: pulka + 1 })}</td>
                    {subtotal.map((s, seat) => (
                      <td key={seat} className="px-1 py-1.5 text-center font-semibold">
                        {done.length ? s : ''}
                        {bonuses[seat] > 0 && (
                          <span className="block text-[10px] font-normal text-gold">
                            +{bonuses[seat]} {t('bonus')}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              );
            })}
            <tr className="text-base">
              <td className="pt-3 pr-2 font-bold">{t('total')}</td>
              {game.totals.map((s, seat) => (
                <td key={seat} className={`pt-3 text-center font-bold ${seat === mySeat ? 'text-gold' : ''}`}>
                  {s}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
