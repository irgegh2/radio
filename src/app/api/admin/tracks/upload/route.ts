import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { isStorageConfigured, uploadTrackFile } from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: 'S3 не настроен. Проверь S3_* в .env.' },
      { status: 503 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Аудиофайл не выбран' }, { status: 400 });
    }

    const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/ogg'];
    if (file.type && !allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Неподдерживаемый формат аудио' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadTrackFile(file.name, file.type || 'audio/mpeg', bytes);

    return NextResponse.json(result);
  } catch (error) {
    console.error('S3 upload failed', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить файл в S3. Проверь ключи и endpoint.' },
      { status: 500 }
    );
  }
}
