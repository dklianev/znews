import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

const storageDriver = String(process.env.STORAGE_DRIVER || 'disk').trim().toLowerCase();
const spacesBucket = String(process.env.SPACES_BUCKET || '').trim();
const spacesRegion = String(process.env.SPACES_REGION || '').trim();
const spacesEndpoint = String(process.env.SPACES_ENDPOINT || '').trim()
  || (spacesRegion ? `https://${spacesRegion}.digitaloceanspaces.com` : '');
const spacesKey = String(process.env.SPACES_KEY || '').trim();
const spacesSecret = String(process.env.SPACES_SECRET || '').trim();
const spacesObjectAcl = String(process.env.SPACES_OBJECT_ACL || 'public-read').trim();
const force = process.argv.includes('--force');

function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function guessContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

async function collectFilesRecursive(baseDir, current = '') {
  const absolute = path.join(baseDir, current);
  const entries = await fs.promises.readdir(absolute, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextRel = current ? path.join(current, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...await collectFilesRecursive(baseDir, nextRel));
      continue;
    }
    if (entry.isFile()) files.push(nextRel);
  }

  return files;
}

async function main() {
  if (storageDriver !== 'spaces') {
    throw new Error('Set STORAGE_DRIVER=spaces before running migration.');
  }

  const missing = [];
  if (!spacesBucket) missing.push('SPACES_BUCKET');
  if (!spacesRegion) missing.push('SPACES_REGION');
  if (!spacesEndpoint) missing.push('SPACES_ENDPOINT');
  if (!spacesKey) missing.push('SPACES_KEY');
  if (!spacesSecret) missing.push('SPACES_SECRET');
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log('No local uploads directory found. Nothing to migrate.');
    return;
  }

  const s3 = new S3Client({
    region: spacesRegion,
    endpoint: spacesEndpoint.replace(/\/+$/, ''),
    forcePathStyle: false,
    credentials: {
      accessKeyId: spacesKey,
      secretAccessKey: spacesSecret,
    },
  });

  const files = await collectFilesRecursive(uploadsDir);
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const relativeFile of files) {
    const relativePosix = toPosixPath(relativeFile);
    const key = `uploads/${relativePosix}`;
    const absolute = path.join(uploadsDir, relativeFile);

    try {
      if (!force) {
        try {
          await s3.send(new HeadObjectCommand({
            Bucket: spacesBucket,
            Key: key,
          }));
          skipped += 1;
          continue;
        } catch (error) {
          const code = error?.$metadata?.httpStatusCode;
          const name = String(error?.name || error?.Code || '').toLowerCase();
          if (!(code === 404 || name.includes('nosuchkey') || name.includes('notfound'))) {
            throw error;
          }
        }
      }

      const body = await fs.promises.readFile(absolute);
      const contentType = guessContentType(relativePosix);
      const params = {
        Bucket: spacesBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: relativePosix.startsWith('_share/') ? 'public, max-age=300' : 'public, max-age=2592000',
      };
      if (spacesObjectAcl) params.ACL = spacesObjectAcl;
      await s3.send(new PutObjectCommand(params));
      uploaded += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed: ${relativePosix} -> ${error?.message || error}`);
    }
  }

  console.log(`Migration summary: total=${files.length} uploaded=${uploaded} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
