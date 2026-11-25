'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gold text-night font-semibold hover:brightness-105 active:brightness-95 disabled:opacity-40',
  secondary: 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20 disabled:opacity-40',
  ghost: 'text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40',
  danger: 'text-red-200 hover:bg-red-500/20 disabled:opacity-40',
};

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Modal({ children, onClose, title }: { children: ReactNode; onClose?: () => void; title?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-deal max-h-[90dvh] w-full max-w-md overflow-auto rounded-2xl bg-[#13392b] p-5 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="mb-4 text-lg font-semibold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === 'ka' ? 'en' : 'ka')}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/15 hover:bg-white/10 ${className}`}
      aria-label="Language"
    >
      {t('language')}
    </button>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-10 text-center">{children}</main>;
}
