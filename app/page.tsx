import App from '../src/App';
import { readContent, publicContent } from '../src/lib/content';

export const dynamic = 'force-dynamic';

export default async function Page() {
  return <App initialContent={publicContent(await readContent())} />;
}
