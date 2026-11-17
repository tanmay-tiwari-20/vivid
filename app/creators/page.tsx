import { notFound } from 'next/navigation';

// Creators are temporarily disabled. Keep the original page for re-enabling later.
// import type { Metadata } from 'next';
// import App from '../../src/App';
// import { readContent, publicContent } from '../../src/lib/content';
//
// export const dynamic = 'force-dynamic';
// export const metadata: Metadata = { title: 'The creators — Vivid Media Works' };
//
// export default async function CreatorsPage() {
//   return <App initialContent={publicContent(await readContent())} page="creators" />;
// }

export default function CreatorsPage() {
  notFound();
}
