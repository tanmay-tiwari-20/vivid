import type { Metadata } from 'next';
import App from '../../src/App';
import { readContent, publicContent } from '../../src/lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'About us — Vivid Media Works',
  description: 'Meet Vivid Media Works, an independent influencer marketing agency bringing brands, creators, and culture together through thoughtful strategy and stories with personality.',
};

export default async function AboutPage() {
  return <App initialContent={publicContent(await readContent())} page="about" />;
}
