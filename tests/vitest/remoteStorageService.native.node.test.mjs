import { describe, expect, it } from 'vitest';

import { createRemoteStorageService } from '../../server/services/remoteStorageService.js';

describe('remote storage service', () => {
  it('parses azure blob listing keys and metadata', async () => {
    const responses = [
      `<?xml version="1.0" encoding="utf-8"?>
      <EnumerationResults>
        <Blobs>
          <Blob>
            <Name>uploads/1770731254072-953761.png</Name>
            <Properties>
              <Last-Modified>Thu, 12 Mar 2026 10:10:00 GMT</Last-Modified>
              <Content-Length>216</Content-Length>
            </Properties>
          </Blob>
          <Blob>
            <Name>uploads/_variants/1770731254072-953761/manifest.json</Name>
            <Properties>
              <Last-Modified>Thu, 12 Mar 2026 10:11:00 GMT</Last-Modified>
              <Content-Length>480</Content-Length>
            </Properties>
          </Blob>
        </Blobs>
        <NextMarker />
      </EnumerationResults>`,
    ];

    const seenUrls = [];
    const service = createRemoteStorageService({
      azureBlobApiVersion: '2023-11-03',
      azureBlobContainer: 'media',
      azureBlobSasToken: 'sig=test',
      encodePathForUrl: (value) => value,
      fetchImpl: async (url) => {
        seenUrls.push(String(url));
        return {
          ok: true,
          text: async () => responses.shift() || '',
        };
      },
      isAzureStorage: true,
      isSpacesStorage: false,
      ListObjectsV2Command: class {},
      DeleteObjectsCommand: class {},
      normalizedAzureBlobEndpoint: 'https://example.blob.core.windows.net',
      spacesBucket: '',
      spacesS3Client: null,
    });

    const items = await service.listRemoteObjectsByPrefix('uploads/');
    expect(items).toEqual([
      {
        Key: 'uploads/1770731254072-953761.png',
        Size: 216,
        LastModified: 'Thu, 12 Mar 2026 10:10:00 GMT',
      },
      {
        Key: 'uploads/_variants/1770731254072-953761/manifest.json',
        Size: 480,
        LastModified: 'Thu, 12 Mar 2026 10:11:00 GMT',
      },
    ]);
    expect(seenUrls[0]).toContain('prefix=uploads%2F');
  });

  it('supports azure blob pagination markers', async () => {
    const responses = [
      `<?xml version="1.0" encoding="utf-8"?>
      <EnumerationResults>
        <Blobs>
          <Blob>
            <Name>uploads/first.png</Name>
            <Properties>
              <Last-Modified>Thu, 12 Mar 2026 10:10:00 GMT</Last-Modified>
              <Content-Length>100</Content-Length>
            </Properties>
          </Blob>
        </Blobs>
        <NextMarker>page-2</NextMarker>
      </EnumerationResults>`,
      `<?xml version="1.0" encoding="utf-8"?>
      <EnumerationResults>
        <Blobs>
          <Blob>
            <Name>uploads/second.png</Name>
            <Properties>
              <Last-Modified>Thu, 12 Mar 2026 10:12:00 GMT</Last-Modified>
              <Content-Length>200</Content-Length>
            </Properties>
          </Blob>
        </Blobs>
        <NextMarker />
      </EnumerationResults>`,
    ];

    const seenUrls = [];
    const service = createRemoteStorageService({
      azureBlobApiVersion: '2023-11-03',
      azureBlobContainer: 'media',
      azureBlobSasToken: 'sig=test',
      encodePathForUrl: (value) => value,
      fetchImpl: async (url) => {
        seenUrls.push(String(url));
        return {
          ok: true,
          text: async () => responses.shift() || '',
        };
      },
      isAzureStorage: true,
      isSpacesStorage: false,
      ListObjectsV2Command: class {},
      DeleteObjectsCommand: class {},
      normalizedAzureBlobEndpoint: 'https://example.blob.core.windows.net',
      spacesBucket: '',
      spacesS3Client: null,
    });

    const items = await service.listRemoteObjectsByPrefix('uploads/');
    expect(items).toHaveLength(2);
    expect(items[0].Key).toBe('uploads/first.png');
    expect(items[1].Key).toBe('uploads/second.png');
    expect(seenUrls[1]).toContain('marker=page-2');
  });

  it('includes response text when azure listing fails', async () => {
    const service = createRemoteStorageService({
      azureBlobApiVersion: '2023-11-03',
      azureBlobContainer: 'media',
      azureBlobSasToken: 'sig=test',
      encodePathForUrl: (value) => value,
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        text: async () => 'azure is unhappy',
      }),
      isAzureStorage: true,
      isSpacesStorage: false,
      ListObjectsV2Command: class {},
      DeleteObjectsCommand: class {},
      normalizedAzureBlobEndpoint: 'https://example.blob.core.windows.net',
      spacesBucket: '',
      spacesS3Client: null,
    });

    await expect(service.listRemoteObjectsByPrefix('uploads/')).rejects.toThrow(
      /Azure Blob list failed \(500\): azure is unhappy/,
    );
  });
});
