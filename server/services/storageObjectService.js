import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export function createStorageObjectService(deps) {
  const {
    DeleteObjectsCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    deleteRemoteKeys,
    getDiskAbsolutePath,
    isAzureStorage,
    isRemoteStorage,
    isSpacesStorage,
    isStorageNotFoundError,
    listRemoteObjectsByPrefix,
    readSdkBodyToBuffer,
    sendAzureBlobRequest,
    spacesBucket,
    spacesObjectAcl,
    spacesS3Client,
    toPosixRelativePath,
    toUploadsStorageKey,
  } = deps;

  function getStorageCacheControl(normalizedPath) {
    return normalizedPath.startsWith('_share/') ? 'public, max-age=300' : 'public, max-age=2592000';
  }

  async function readAzureFailure(response, action) {
    const details = await response.text().catch(() => '');
    return new Error(`Azure Blob ${action} failed (${response.status})${details ? `: ${details.slice(0, 240)}` : ''}`);
  }

  async function writeLocalObjectAtomically(absolutePath, body) {
    const dir = path.dirname(absolutePath);
    await fs.promises.mkdir(dir, { recursive: true });

    const tmpPath = path.join(dir, `.${path.basename(absolutePath)}.tmp-${randomUUID()}`);
    await fs.promises.writeFile(tmpPath, body);
    try {
      await fs.promises.rename(tmpPath, absolutePath);
    } catch {
      try { await fs.promises.unlink(absolutePath); } catch { }
      await fs.promises.rename(tmpPath, absolutePath);
    } finally {
      fs.promises.unlink(tmpPath).catch(() => { });
    }
  }

  async function putStorageObject(relativePath, body, contentType = 'application/octet-stream') {
    const normalized = toPosixRelativePath(relativePath);
    if (!normalized) throw new Error('Invalid storage path');
    const cacheControl = getStorageCacheControl(normalized);

    if (isSpacesStorage) {
      const params = {
        Bucket: spacesBucket,
        Key: toUploadsStorageKey(normalized),
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      };
      if (spacesObjectAcl) params.ACL = spacesObjectAcl;
      await spacesS3Client.send(new PutObjectCommand(params));
      return;
    }
    if (isAzureStorage) {
      const response = await sendAzureBlobRequest(toUploadsStorageKey(normalized), {
        method: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': contentType,
          'x-ms-blob-content-type': contentType,
          'x-ms-blob-cache-control': cacheControl,
          'Cache-Control': cacheControl,
        },
        body,
      });
      if (!response.ok) {
        throw await readAzureFailure(response, 'upload');
      }
      return;
    }

    await writeLocalObjectAtomically(getDiskAbsolutePath(normalized), body);
  }

  async function getStorageObjectBuffer(relativePath) {
    const normalized = toPosixRelativePath(relativePath);
    if (!normalized) return null;

    if (isSpacesStorage) {
      try {
        const response = await spacesS3Client.send(new GetObjectCommand({
          Bucket: spacesBucket,
          Key: toUploadsStorageKey(normalized),
        }));
        return await readSdkBodyToBuffer(response.Body);
      } catch (error) {
        if (isStorageNotFoundError(error)) return null;
        throw error;
      }
    }
    if (isAzureStorage) {
      const response = await sendAzureBlobRequest(toUploadsStorageKey(normalized), { method: 'GET' });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw await readAzureFailure(response, 'read');
      }
      return Buffer.from(await response.arrayBuffer());
    }

    const absolute = getDiskAbsolutePath(normalized);
    try {
      return await fs.promises.readFile(absolute);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async function storageObjectExists(relativePath) {
    const normalized = toPosixRelativePath(relativePath);
    if (!normalized) return false;

    if (isSpacesStorage) {
      try {
        await spacesS3Client.send(new HeadObjectCommand({
          Bucket: spacesBucket,
          Key: toUploadsStorageKey(normalized),
        }));
        return true;
      } catch (error) {
        if (isStorageNotFoundError(error)) return false;
        throw error;
      }
    }
    if (isAzureStorage) {
      const response = await sendAzureBlobRequest(toUploadsStorageKey(normalized), { method: 'HEAD' });
      if (response.status === 404) return false;
      if (!response.ok) {
        throw await readAzureFailure(response, 'HEAD');
      }
      return true;
    }

    try {
      await fs.promises.access(getDiskAbsolutePath(normalized), fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async function deleteStorageObject(relativePath) {
    const normalized = toPosixRelativePath(relativePath);
    if (!normalized) return;

    if (isSpacesStorage) {
      await spacesS3Client.send(new DeleteObjectsCommand({
        Bucket: spacesBucket,
        Delete: {
          Objects: [{ Key: toUploadsStorageKey(normalized) }],
          Quiet: true,
        },
      }));
      return;
    }
    if (isAzureStorage) {
      const response = await sendAzureBlobRequest(toUploadsStorageKey(normalized), { method: 'DELETE' });
      if (response.status === 404) return;
      if (!response.ok) {
        throw await readAzureFailure(response, 'delete');
      }
      return;
    }

    await fs.promises.unlink(getDiskAbsolutePath(normalized));
  }

  async function deleteStoragePrefix(relativePrefix) {
    const normalizedPrefix = toPosixRelativePath(relativePrefix);
    if (!normalizedPrefix) return;

    if (isRemoteStorage) {
      const prefixKey = toUploadsStorageKey(normalizedPrefix.endsWith('/') ? normalizedPrefix : `${normalizedPrefix}/`);
      const objects = await listRemoteObjectsByPrefix(prefixKey);
      await deleteRemoteKeys(objects.map((item) => item.Key).filter(Boolean));
      return;
    }

    await fs.promises.rm(getDiskAbsolutePath(normalizedPrefix), { recursive: true, force: true });
  }

  return {
    deleteStorageObject,
    deleteStoragePrefix,
    getStorageObjectBuffer,
    putStorageObject,
    storageObjectExists,
  };
}
