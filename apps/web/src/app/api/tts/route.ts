/**
 * POST /api/tts
 * Generate Malayalam TTS audio for a stop name via Google Cloud TTS.
 * Saves to R2 and returns the public URL.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/api-guard';
import { uploadToR2 } from '@/lib/r2';

const schema = z.object({
  text:   z.string().min(1),
  stopId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin']);
  if (!auth.ok) return auth.response;

  const body   = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid input' }, { status: 400 });

  try {
    // Dynamic import — only load on server
    const { TextToSpeechClient } = await import('@google-cloud/text-to-speech');
    const client = new TextToSpeechClient();

    const [response] = await client.synthesizeSpeech({
      input: { text: parsed.data.text },
      voice: {
        languageCode: 'ml-IN',
        name: 'ml-IN-Standard-A',
        ssmlGender: 'FEMALE',
      },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 },
    });

    if (!response.audioContent) throw new Error('No audio content returned');

    const key = `audio/stops/${parsed.data.stopId}.mp3`;
    const url = await uploadToR2(key, response.audioContent as Buffer, 'audio/mpeg');

    return NextResponse.json({ ok: true, data: { url } });
  } catch (err: any) {
    console.error('[tts]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
