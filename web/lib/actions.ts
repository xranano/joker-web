'use client';
import { useRouter } from 'next/navigation';
import { request } from './socket';

export function useLeave() {
  const router = useRouter();
  return async () => {
    await request('room:leave', undefined, 2000);
    router.push('/');
  };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // http on a LAN IP has no clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
