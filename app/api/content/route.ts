import { apiError, json } from '../../../src/lib/api';
import { publicContent, readContent } from '../../../src/lib/content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { return json(publicContent(await readContent())); }
  catch (error) { return apiError(error); }
}
