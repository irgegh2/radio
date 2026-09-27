import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { createTrackUploadUrl, isStorageConfigured } from '@/lib/storage';

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: 'S3 пока не настроен. Заполни S3_* в .env.' },
      { status: 503 }
    );
  }

  const { fileName, contentType } = await req.json();

  return NextResponse.json(
    await createTrackUploadUrl(
      String(fileName),
      String(contentType || 'audio/mpeg')
    )
  );
}
