import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import {
  createTrackPlaybackUrl,
  isStorageConfigured,
  uploadCoverFile
} from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'S3 не настроен' }, { status: 503 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Изображение не выбрано' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Нужен файл изображения' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Обложка больше 10 МБ' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await uploadCoverFile(file.name, file.type || 'image/jpeg', bytes);
    const previewUrl = await createTrackPlaybackUrl(uploaded.key);

    return NextResponse.json({
      key: uploaded.key,
      previewUrl
    });
  } catch (error) {
    console.error('Cover upload failed', error);
    return NextResponse.json({ error: 'Не удалось загрузить обложку в S3' }, { status: 500 });
  }
}
