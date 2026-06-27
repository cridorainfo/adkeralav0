import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const districts = await prisma.district.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json({ ok: true, data: districts });
}
