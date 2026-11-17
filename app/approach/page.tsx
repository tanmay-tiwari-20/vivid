import type { Metadata } from 'next';
import App from '../../src/App';
import { readContent, publicContent } from '../../src/lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Our approach — Vivid Media Works',
  description: 'Discover how Vivid Media Works connects audience insight, creator partnerships, thoughtful campaign delivery, and meaningful measurement to turn brand ambition into stories with impact.',
};

export default async function ApproachPage() {
  return <App initialContent={publicContent(await readContent())} page="approach" />;
}
