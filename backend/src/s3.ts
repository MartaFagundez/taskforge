import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REGION = process.env.AWS_REGION!;
export const S3_BUCKET = process.env.S3_BUCKET!;

export const s3 = new S3Client({ region: REGION });

export async function getUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
) {
  // URL firmada para PUT
  const cmd = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  // expira en 5 min
  return getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });
}

export async function getDownloadUrl(key: string) {
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  // expira en 2 min
  return getSignedUrl(s3, cmd, { expiresIn: 60 * 2 });
}
