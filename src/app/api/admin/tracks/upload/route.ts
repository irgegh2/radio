import { NextResponse } from 'next/server';
import { parseBuffer } from 'music-metadata';
import { isAdmin } from '@/lib/auth';
import {
  isStorageConfigured,
  uploadCoverFile,
  uploadTrackFile
} from '@/lib/storage';

export const runtime = 'nodejs';

function extensionForMime(mime: string) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

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

    const allowed = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/mp4',
      'audio/aac',
      'audio/ogg'
    ];

    if (file.type && !allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Неподдерживаемый формат аудио' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const metadata = await parseBuffer(bytes, {
      mimeType: file.type || 'audio/mpeg',
      size: file.size
    });

    const audio = await uploadTrackFile(file.name, file.type || 'audio/mpeg', bytes);

    let coverKey: string | null = null;
    const picture = metadata.common.picture?.[0];

    if (picture?.data?.length) {
      const extension = extensionForMime(picture.format || 'image/jpeg');
      const cover = await uploadCoverFile(
        `${file.name.replace(/\.[^.]+$/, '')}-cover.${extension}`,
        picture.format || 'image/jpeg',
        new Uint8Array(picture.data)
      );
      coverKey = cover.key;
    }

    const titleFromName = file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();

    return NextResponse.json({
      key: audio.key,
      coverKey,
      metadata: {
        title: metadata.common.title || titleFromName,
        artist: metadata.common.artist || metadata.common.albumartist || '',
        genre: metadata.common.genre?.[0] || '',
        album: metadata.common.album || '',
        year: metadata.common.year || null,
        duration: metadata.format.duration ? Math.max(1, Math.round(metadata.format.duration)) : null
      }
    });
  } catch (error) {
    console.error('S3 upload/metadata failed', error);
    return NextResponse.json(
      { error: 'Не удалось прочитать или загрузить файл. Проверь MP3 и настройки S3.' },
      { status: 500 }
    );
  }
}
