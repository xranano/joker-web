import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">404</h1>
      <Link href="/" className="rounded-xl bg-white/10 px-4 py-2.5 text-sm hover:bg-white/15">
        Joker · ჯოკერი
      </Link>
    </main>
  );
}
