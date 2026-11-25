import { randomInt } from 'node:crypto';
import { RULES } from '@joker/engine';

/** Trim, drop control/markup characters, collapse spaces, cap length. Returns null if empty. */
export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}<>&"'`\\]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const capped = Array.from(cleaned).slice(0, RULES.maxNameLength).join('').trim();
  return capped.length > 0 ? capped : null;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRoomCode(): string {
  let code = '';
  for (let i = 0; i < RULES.roomCodeLength; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function normalizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return new RegExp(`^[${CODE_ALPHABET}]{${RULES.roomCodeLength}}$`).test(code) ? code : null;
}

export function isValidPlayerId(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(raw);
}
