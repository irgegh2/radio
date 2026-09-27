import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function config() {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

function client() {
  const c = config();
  if (!c) throw new Error('S3 is not configured');

  return {
    c,
    s3: new S3Client({
      endpoint: c.endpoint,
      region: process.env.S3_REGION || 'auto',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
      credentials: {
        accessKeyId: c.accessKeyId,
        secretAccessKey: c.secretAccessKey
      }
    })
  };
}

export function isStorageConfigured() {
  return Boolean(config());
}

export async function uploadTrackFile(fileName: string, contentType: string, body: Uint8Array) {
  const { c, s3 } = client();
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `tracks/${Date.now()}-${safe}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: key,
      ContentType: contentType || 'audio/mpeg',
      Body: body
    })
  );

  return { key };
}

export async function createTrackPlaybackUrl(key: string) {
  const { c, s3 } = client();
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: c.bucket,
      Key: key
    }),
    { expiresIn: 3600 }
  );
}

export async function createTrackUploadUrl(fileName: string, contentType: string) {
  const { c, s3 } = client();
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `tracks/${Date.now()}-${safe}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: key,
      ContentType: contentType
    }),
    { expiresIn: 900 }
  );

  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '');
  const publicUrl = base
    ? `${base}/${key}`
    : `${c.endpoint.replace(/\/$/, '')}/${c.bucket}/${key}`;

  return { key, uploadUrl, publicUrl };
}
