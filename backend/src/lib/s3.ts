import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
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

export async function deleteObject(key: string) {
  const cmd = new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key });
  await s3.send(cmd);
}

// Borra varios objetos (hasta 1000)
// A utilizar cuando se quiera eliminar una tarea
export async function deleteObjects(keys: string[]) {
  if (keys.length === 0) return;
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 1000)
    chunks.push(keys.slice(i, i + 1000));
  for (const chunk of chunks) {
    const cmd = new DeleteObjectsCommand({
      Bucket: S3_BUCKET,
      Delete: { Objects: chunk.map((k) => ({ Key: k })) },
    });
    const res = await s3.send(cmd);
    if (res.Errors && res.Errors.length > 0) {
      const sample = res.Errors[0];
      throw new Error(
        `Fallo al borrar en S3 (p.ej. ${sample.Key}: ${sample.Code} ${sample.Message})`,
      );
    }
  }
}
