'use client';
import { useEffect, useState } from 'react';
import { MODES, RULES, buildSchedule } from '@joker/engine';
import type { RoomSnapshot } from '@joker/engine/protocol';
import { copyText, useLeave } from '@/lib/actions';
import { useI18n } from '@/lib/i18n';
import type { DictKey } from '@/lib/dictionary';
import { request } from '@/lib/socket';
import { Button, LangToggle } from './ui';

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-black/25 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-2 py-2 text-sm transition ${
            value === o.value ? 'bg-gold font-semibold text-night' : 'text-white/75 enabled:hover:bg-white/10'
          } disabled:cursor-default`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Lobby({ snap }: { snap: RoomSnapshot }) {
  const { t } = useI18n();
  const leave = useLeave();
  const isHost = snap.you.isHost;
  const [copied, setCopied] = useState(false);
  const [customKhishti, setCustomKhishti] = useState('');
  const [error, setError] = useState('');
  const presets = RULES.khishtiOptions as readonly number[];
  const isCustom = !presets.includes(snap.settings.khishti);
  const [customMode, setCustomMode] = useState(isCustom);
  useEffect(() => {
    if (isCustom) setCustomKhishti(String(Math.abs(snap.settings.khishti)));
  }, [isCustom, snap.settings.khishti]);

  const link = typeof window !== 'undefined' ? `${window.location.origin}/room/${snap.code}` : '';
  const set = (patch: object) => request('room:settings', patch);
  const full = snap.seats.every(Boolean);

  const start = async () => {
    const r = await request('room:start');
    if (!r.ok) setError(t('genericError'));
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('appName')}</h1>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Button variant="ghost" className="px-3 py-1.5" onClick={leave}>
            {t('leave')}
          </Button>
        </div>
      </header>

      <section className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <p className="text-xs uppercase tracking-wider text-white/50">{t('room')}</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em]">{snap.code}</p>
        <p className="mt-3 text-sm text-white/65">{t('shareHint')}</p>
        <div className="mt-2 flex gap-2">
          <input
            readOnly
            value={link}
            aria-label="Link"
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 truncate rounded-xl bg-black/25 px-3 py-2.5 text-sm text-white/80 outline-none"
          />
          <Button
            variant="primary"
            onClick={async () => {
              if (await copyText(link)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }
            }}
          >
            {copied ? t('copied') : t('copyLink')}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">{t('players')}</h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {snap.seats.map((seat, i) => (
            <li
              key={i}
              className={`flex min-h-16 items-center gap-3 rounded-xl px-3 py-2 ring-1 ${
                seat ? 'bg-white/8 ring-white/10' : 'border border-dashed border-white/20 ring-transparent'
              }`}
            >
              {seat ? (
                <>
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      seat.isBot ? 'bg-sky-400/20 text-sky-200' : 'bg-gold/20 text-gold'
                    }`}
                  >
                    {seat.isBot ? '🤖' : seat.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {seat.name}
                      {snap.you.seat === i && <span className="ml-1 text-white/50">({t('you')})</span>}
                    </p>
                    <p className="text-xs text-white/50">
                      {seat.isHost && <span className="mr-2 text-gold">★ {t('host')}</span>}
                      {seat.isBot ? t('bot') : !seat.connected && t('offline')}
                    </p>
                  </div>
                  {isHost && snap.you.seat !== i && (
                    <Button variant="danger" className="px-2.5 py-1.5 text-xs" onClick={() => request('room:kick', { seat: i })}>
                      {t('remove')}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-white/40">{t('seatEmpty')}</span>
                  {isHost && (
                    <Button className="px-3 py-1.5 text-xs" onClick={() => request('room:addBot', { seat: i })}>
                      + {t('addBot')}
                    </Button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">{t('settings')}</h2>
        <div>
          <p className="mb-1.5 text-sm text-white/70">{t('mode')}</p>
          <Segmented
            label={t('mode')}
            disabled={!isHost}
            value={snap.settings.mode}
            onChange={(mode) => set({ mode })}
            options={Object.keys(MODES).map((id) => ({
              value: id,
              label: `${t(`mode_${id}` as DictKey)} · ${t('nHands', { n: buildSchedule(id).length })}`,
            }))}
          />
        </div>
        <div>
          <p className="mb-1.5 text-sm text-white/70">{t('khishti')}</p>
          <Segmented
            label={t('khishti')}
            disabled={!isHost}
            value={customMode || isCustom ? 'custom' : String(snap.settings.khishti)}
            onChange={(v) => {
              if (v === 'custom') {
                setCustomMode(true);
                setCustomKhishti(String(Math.abs(snap.settings.khishti)));
              } else {
                setCustomMode(false);
                set({ khishti: Number(v) });
              }
            }}
            options={[...presets.map((k) => ({ value: String(k), label: String(k) })), { value: 'custom', label: t('custom') }]}
          />
          {(customMode || isCustom) && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-lg text-white/60">−</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                disabled={!isHost}
                value={customKhishti}
                aria-label={`${t('khishti')} ${t('custom')}`}
                onChange={(e) => setCustomKhishti(e.target.value)}
                onBlur={() => customKhishti && set({ khishti: -Math.abs(Number(customKhishti)) })}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="w-32 rounded-lg bg-black/25 px-3 py-2 text-base outline-none ring-1 ring-white/15 focus:ring-gold disabled:opacity-60"
              />
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-sm text-white/70">{t('turnTimer')}</p>
          <Segmented
            label={t('turnTimer')}
            disabled={!isHost}
            value={snap.settings.turnTimer}
            onChange={(turnTimer) => set({ turnTimer })}
            options={(RULES.turnTimerOptions as readonly number[]).map((n) => ({ value: n, label: n ? t('nSec', { n }) : t('off') }))}
          />
        </div>
      </section>

      {isHost ? (
        <div className="sticky bottom-0 -mx-4 bg-night/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <Button variant="primary" className="w-full py-3.5 text-base" disabled={!full} onClick={start}>
            {t('start')}
          </Button>
          {!full && <p className="mt-2 text-center text-xs text-white/55">{t('needFour')}</p>}
          {error && <p className="mt-2 text-center text-xs text-red-300">{error}</p>}
        </div>
      ) : (
        <p className="text-center text-sm text-white/60">{t('waitingHost')}</p>
      )}
    </main>
  );
}
