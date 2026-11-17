import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import '../src/styles.css';
import '../src/sections.css';
import '../src/content.css';
import '../src/brands.css';
import '../src/home.css';
import '../src/home-sections.css';
import '../src/home-brands.css';
import '../src/work.css';
import '../src/work-hero.css';
import '../src/work-brands.css';
// Creators are temporarily disabled; retain their styles for later.
// import '../src/creators.css';
// import '../src/creators-hero.css';
import '../src/hero-reels.css';

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

export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={manrope.variable}><body>{children}</body></html>;
}
