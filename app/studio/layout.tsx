import type { Metadata } from 'next';
import '../../src/admin/studio.css';

export const metadata: Metadata = {
  title: 'Vivid Studio — Content management',
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
