import type { Metadata } from 'next';
import App from '../../src/App';
import { readContent, publicContent } from '../../src/lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'The creators — Vivid Media Works' };

export default async function CreatorsPage() {
  return <App initialContent={publicContent(await readContent())} page="creators" />;
}
