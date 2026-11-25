'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DICT, type DictKey, type Lang } from './dictionary';

type T = (key: DictKey, vars?: Record<string, string | number>) => string;
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: T } | null>(null);
const KEY = 'joker.lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ka');
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    if (saved === 'en' || saved === 'ka') setLangState(saved);
    else if (!navigator.language.toLowerCase().startsWith('ka')) setLangState('en');
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }, []);
  const t = useCallback<T>(
    (key, vars) => {
      let s: string = DICT[key][lang];
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}
