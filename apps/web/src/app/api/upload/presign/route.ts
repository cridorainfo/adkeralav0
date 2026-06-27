/**
 * POST /api/upload/presign
 * Returns a pre-signed R2 URL for direct browser-to-R2 upload.
 * Used for: stop audio files, ad media.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/api-guard';
import { getPresignedUploadUrl } from '@/lib/r2';

const schema = z.object({
  key:         z.string().min(1),
  contentType: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin', 'advertiser']);
  if (!auth.ok) return auth.response;

  const body   = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid input' }, { status: 400 });

  const url = await getPresignedUploadUrl(parsed.data.key, parsed.data.contentType);
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${parsed.data.key}`;

  return NextResponse.json({ ok: true, data: { uploadUrl: url, publicUrl } });
}
