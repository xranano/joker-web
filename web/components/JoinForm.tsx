'use client';
import { useEffect, useState } from 'react';
import { RULES } from '@joker/engine';
import { getSavedName } from '@/lib/identity';
import { useI18n } from '@/lib/i18n';
import type { DictKey } from '@/lib/dictionary';
import { Button, Centered, LangToggle } from './ui';

const ERRORS: Record<string, DictKey> = { nameTaken: 'nameTaken', invalidName: 'invalidName', timeout: 'serverDown' };

export function JoinForm({ code, onJoin }: { code: string; onJoin: (name: string) => Promise<string | null> }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(getSavedName()), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t('invalidName'));
    setBusy(true);
    const err = await onJoin(name);
    setBusy(false);
    if (err) setError(t(ERRORS[err] ?? 'genericError'));
  };

  return (
    <Centered>
      <LangToggle className="fixed right-4 top-4" />
      <p className="font-mono text-sm tracking-[0.3em] text-white/50">{code}</p>
      <h1 className="text-2xl font-semibold">{t('joinTitle')}</h1>
      <form onSubmit={submit} className="flex w-full max-w-xs flex-col gap-3">
        <label htmlFor="name" className="sr-only">
          {t('yourName')}
        </label>
        <input
          id="name"
          autoFocus
          value={name}
          maxLength={RULES.maxNameLength}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          placeholder={t('yourName')}
          autoComplete="nickname"
          className="rounded-xl bg-white/10 px-4 py-3 text-center text-base outline-none ring-1 ring-white/15 placeholder:text-white/35 focus:ring-gold"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <Button type="submit" variant="primary" className="py-3 text-base" disabled={busy}>
          {t('join')}
        </Button>
      </form>
    </Centered>
  );
}
