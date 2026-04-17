import * as Minio from 'minio';
import { env } from '../env.js';

const endpoint = new URL(env.S3_ENDPOINT);

const minioClient = new Minio.Client({
  endPoint: endpoint.hostname,
  port: Number(endpoint.port) || (endpoint.protocol === 'https:' ? 443 : 9000),
  useSSL: endpoint.protocol === 'https:',
  accessKey: env.S3_ACCESS_KEY,
  secretKey: env.S3_SECRET_KEY,
  region: env.S3_REGION,
});

const ensuredBuckets = new Set<string>();

export async function ensureBucket(bucketName: string): Promise<void> {
  if (ensuredBuckets.has(bucketName)) return;
  const exists = await minioClient.bucketExists(bucketName);
  if (!exists) {
    await minioClient.makeBucket(bucketName, env.S3_REGION);
  }
  ensuredBuckets.add(bucketName);
}

export async function uploadFile(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  await ensureBucket(bucket);
  await minioClient.putObject(bucket, key, buffer, buffer.length, {
    'Content-Type': contentType,
  });
}

export async function deleteFile(bucket: string, key: string): Promise<void> {
  try {
    await minioClient.removeObject(bucket, key);
  } catch {
    // Swallow — the DB row is the source of truth. If the object was
    // already removed (or never fully uploaded), the caller should still
    // be allowed to drop the metadata row.
  }
}

export async function getPresignedGetUrl(
  bucket: string,
  key: string,
  expirySeconds = 24 * 60 * 60,
): Promise<string> {
  return minioClient.presignedGetObject(bucket, key, expirySeconds);
}
