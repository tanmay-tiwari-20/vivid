import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import '../src/styles.css';
import '../src/sections.css';

const manrope = localFont({
  src: '../public/fonts/manrope-variable.woff2',
  weight: '200 800',
  display: 'swap',
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'Vivid Media Works — Influence with intent.',
  description: 'Vivid Media Works brings brands, creators, and culture together. An independent influencer marketing agency built for meaningful connections.',
  icons: { icon: '/favicon.svg' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#111210', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={manrope.variable}><body>{children}</body></html>;
}
