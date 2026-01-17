import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'us-east-1', // MinIO doesn't care about region, but SDK requires it
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true, // Required for MinIO
});

const bucket = process.env.S3_BUCKET || 'uploads';

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Return the public URL
  const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
  return `${endpoint}/${bucket}/${key}`;
}

export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await s3Client.send(command);
}

export async function getFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await s3Client.send(command);
  const stream = response.Body;

  if (!stream) {
    throw new Error('No body in response');
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export function getS3KeyFromUrl(url: string): string | null {
  const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
  const prefix = `${endpoint}/${bucket}/`;
  
  if (url.startsWith(prefix)) {
    return url.slice(prefix.length);
  }
  
  return null;
}

export { s3Client, bucket };
