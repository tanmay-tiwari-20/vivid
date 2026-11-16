import { requireAdmin } from '../../../../src/lib/admin-auth';
import { apiError, json, readJson, requireSameOrigin } from '../../../../src/lib/api';
import { readContent, saveContent } from '../../../../src/lib/content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { await requireAdmin(); return json(await readContent()); }
  catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    return json(await saveContent(await readJson(request, 8 * 1024 * 1024)));
  } catch (error) { return apiError(error); }
}
