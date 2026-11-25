import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Georgian } from 'next/font/google';
import { I18nProvider } from '@/lib/i18n';
import './globals.css';

const georgian = Noto_Sans_Georgian({ subsets: ['georgian', 'latin'], variable: '--font-georgian', display: 'swap' });

export const metadata: Metadata = {
  title: 'Joker · ჯოკერი',
  description: 'The Georgian card game Joker. Play with friends online via a shared link.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b241b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka" className={georgian.variable}>
      <body className="font-sans antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
