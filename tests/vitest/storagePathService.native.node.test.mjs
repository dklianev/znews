import { describe, expect, it } from 'vitest';

import { createStoragePathService } from '../../server/services/storagePathService.js';

describe('storagePathService', () => {
  it('keeps the blob-key uploads prefix when the public base URL points at the Azure container', () => {
    const service = createStoragePathService({
      isRemoteStorage: true,
      storagePublicBaseUrl: 'https://znewsmedia01.blob.core.windows.net/uploads/',
      storageUploadsPrefix: 'uploads',
      uploadsDir: 'uploads',
    });

    expect(service.toUploadsUrlFromRelative('_variants/photo/w640.avif')).toBe(
      'https://znewsmedia01.blob.core.windows.net/uploads/uploads/_variants/photo/w640.avif',
    );
    expect(service.toUploadsStorageKey('uploads/uploads/photo.webp')).toBe('uploads/photo.webp');
  });

  it('adds the uploads prefix when the public base URL is the storage account root', () => {
    const service = createStoragePathService({
      isRemoteStorage: true,
      storagePublicBaseUrl: 'https://znewsmedia01.blob.core.windows.net',
      storageUploadsPrefix: 'uploads',
      uploadsDir: 'uploads',
    });

    expect(service.toUploadsUrlFromRelative('photo.webp')).toBe(
      'https://znewsmedia01.blob.core.windows.net/uploads/photo.webp',
    );
  });
});
