export function createRemoteStorageService(deps) {
  const {
    azureBlobApiVersion,
    azureBlobContainer,
    azureBlobSasToken,
    encodePathForUrl,
    fetchImpl = fetch,
    isAzureStorage,
    isSpacesStorage,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    normalizedAzureBlobEndpoint,
    spacesBucket,
    spacesS3Client,
  } = deps;

  function decodeXmlEntities(value) {
    return String(value || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  function extractXmlTagValue(xml, tagName) {
    const match = String(xml || '').match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'));
    return match?.[1] ? decodeXmlEntities(match[1].trim()) : '';
  }

  function buildAzureBlobUrl(blobKey = '', extraQuery = {}) {
    const base = `${normalizedAzureBlobEndpoint}/${encodeURIComponent(azureBlobContainer)}${blobKey ? `/${encodePathForUrl(blobKey)}` : ''}`;
    const query = new URLSearchParams(azureBlobSasToken);
    Object.entries(extraQuery || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      query.set(key, String(value));
    });
    const asString = query.toString();
    return asString ? `${base}?${asString}` : base;
  }

  async function sendAzureBlobRequest(blobKey = '', options = {}, extraQuery = {}) {
    return fetchImpl(buildAzureBlobUrl(blobKey, extraQuery), {
      method: options.method || 'GET',
      headers: {
        'x-ms-version': azureBlobApiVersion,
        ...(options.headers || {}),
      },
      body: options.body,
    });
  }

  function parseAzureListBlobsResult(xmlPayload) {
    const xml = String(xmlPayload || '');
    const blobs = [];
    const blobRegex = /<Blob>([\s\S]*?)<\/Blob>/gi;
    let match = null;

    while ((match = blobRegex.exec(xml)) !== null) {
      const chunk = match[1] || '';
      const key = extractXmlTagValue(chunk, 'Name');
      if (!key) continue;
      const size = Number.parseInt(extractXmlTagValue(chunk, 'Content-Length') || '0', 10) || 0;
      const lastModified = extractXmlTagValue(chunk, 'Last-Modified');
      blobs.push({
        Key: key,
        Size: size,
        LastModified: lastModified || null,
      });
    }

    return {
      blobs,
      nextMarker: extractXmlTagValue(xml, 'NextMarker'),
    };
  }

  async function listAzureObjectsByPrefix(prefixKey) {
    const items = [];
    let marker = '';

    do {
      const response = await sendAzureBlobRequest('', {}, {
        restype: 'container',
        comp: 'list',
        prefix: prefixKey,
        marker,
        maxresults: 5000,
      });
      if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`Azure Blob list failed (${response.status})${details ? `: ${details.slice(0, 240)}` : ''}`);
      }
      const xml = await response.text();
      const parsed = parseAzureListBlobsResult(xml);
      items.push(...parsed.blobs);
      marker = parsed.nextMarker || '';
    } while (marker);

    return items;
  }

  async function deleteAzureKeys(keys) {
    if (!isAzureStorage || !Array.isArray(keys) || keys.length === 0) return;

    const batchSize = 50;
    for (let index = 0; index < keys.length; index += batchSize) {
      const chunk = keys
        .slice(index, index + batchSize)
        .filter(Boolean);
      if (chunk.length === 0) continue;

      await Promise.all(chunk.map(async (blobKey) => {
        const response = await sendAzureBlobRequest(blobKey, { method: 'DELETE' });
        if (response.status === 404) return;
        if (!response.ok) {
          const details = await response.text().catch(() => '');
          throw new Error(`Azure Blob delete failed (${response.status})${details ? `: ${details.slice(0, 240)}` : ''}`);
        }
      }));
    }
  }

  async function listRemoteObjectsByPrefix(prefixKey) {
    if (isSpacesStorage) {
      const items = [];
      let continuationToken = undefined;

      do {
        const response = await spacesS3Client.send(new ListObjectsV2Command({
          Bucket: spacesBucket,
          Prefix: prefixKey,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        }));
        items.push(...(response.Contents || []));
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);

      return items;
    }

    if (isAzureStorage) {
      return listAzureObjectsByPrefix(prefixKey);
    }

    return [];
  }

  async function deleteRemoteKeys(keys) {
    if (!Array.isArray(keys) || keys.length === 0) return;
    if (isSpacesStorage) {
      const batchSize = 500;
      for (let index = 0; index < keys.length; index += batchSize) {
        const chunk = keys
          .slice(index, index + batchSize)
          .filter(Boolean)
          .map((key) => ({ Key: key }));
        if (chunk.length === 0) continue;
        await spacesS3Client.send(new DeleteObjectsCommand({
          Bucket: spacesBucket,
          Delete: {
            Objects: chunk,
            Quiet: true,
          },
        }));
      }
      return;
    }

    if (isAzureStorage) {
      await deleteAzureKeys(keys);
    }
  }

  return {
    deleteRemoteKeys,
    listRemoteObjectsByPrefix,
    sendAzureBlobRequest,
  };
}
