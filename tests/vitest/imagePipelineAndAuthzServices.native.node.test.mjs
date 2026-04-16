import { describe, expect, it, vi } from 'vitest';
import { createImagePipelineService } from '../../server/services/imagePipelineService.js';
import { createUploadDedupService } from '../../server/services/uploadDedupService.js';
import { createAuthzService } from '../../server/services/authzService.js';

describe('imagePipelineAndAuthzServices', () => {
  it('builds image manifests and syncs stored image meta', async () => {
    const putStorageObject = vi.fn(async () => {});
    const service = createImagePipelineService({
      Article: { updateMany: vi.fn(async () => ({ modifiedCount: 2 })) },
      Tip: { updateMany: vi.fn(async () => ({ modifiedCount: 1 })) },
      allowedImageExtensions: new Set(['.jpg', '.png', '.webp']),
      getManifestAbsolutePath: (fileName) => `C:/tmp/${fileName}/manifest.json`,
      getManifestRelativePath: (fileName) => `variants/${fileName}/manifest.json`,
      getOriginalUploadUrl: (fileName) => `/uploads/${fileName}`,
      getStorageObjectBuffer: async (key) => {
        if (key.endsWith('manifest.json')) return null;
        return Buffer.from('image');
      },
      getVariantsAbsoluteDir: (fileName) => `C:/tmp/${fileName}`,
      getVariantsRelativeDir: (fileName) => `variants/${fileName}`,
      imagePipelineWidths: [320, 640],
      isOriginalUploadFileName: (value) => String(value).endsWith('.jpg'),
      isRemoteStorage: true,
      listRemoteObjectsByPrefix: async () => [],
      loadSharp: async () => {
        const instance = {
          rotate() { return this; },
          async metadata() { return { width: 800, height: 600, format: 'jpeg' }; },
          resize() { return this; },
          webp() { return this; },
          avif() { return this; },
          blur() { return this; },
          async toBuffer() { return Buffer.from('variant'); },
        };
        return () => ({ ...instance });
      },
      putStorageObject,
      toUploadsStorageKey: (value) => `uploads/${value}`,
      toUploadsUrlFromRelative: (value) => `/uploads/${value}`,
      uploadsDir: 'C:/tmp/uploads',
    });

    const manifest = await service.ensureImagePipeline('hero.jpg');
    expect(manifest.original.width).toBe(800);
    expect(manifest.variants).toHaveLength(2);
    expect(putStorageObject).toHaveBeenCalled();

    const imageMeta = service.toImageMetaFromManifest(manifest);
    expect(imageMeta.webp).toHaveLength(2);
    expect(service.getUploadFilenameFromUrl('/uploads/hero.jpg')).toBe('hero.jpg');
  });

  it('reuses a shared media snapshot between files and pipeline status lookups', async () => {
    const listRemoteObjectsByPrefix = vi.fn(async (prefix) => {
      if (prefix === 'uploads/') {
        return [
          {
            Key: 'uploads/hero.jpg',
            Size: 1024,
            LastModified: '2026-04-15T10:00:00.000Z',
          },
        ];
      }
      if (prefix === 'uploads/_variants/') {
        return [
          {
            Key: 'uploads/_variants/hero/manifest.json',
            Size: 320,
            LastModified: '2026-04-15T10:00:01.000Z',
          },
        ];
      }
      return [];
    });
    const getStorageObjectBuffer = vi.fn(async () => null);

    const service = createImagePipelineService({
      Article: { updateMany: vi.fn(async () => ({ modifiedCount: 0 })) },
      Tip: { updateMany: vi.fn(async () => ({ modifiedCount: 0 })) },
      allowedImageExtensions: new Set(['.jpg', '.png', '.webp']),
      getManifestAbsolutePath: (fileName) => `C:/tmp/${fileName}/manifest.json`,
      getManifestRelativePath: (fileName) => `variants/${fileName}/manifest.json`,
      getOriginalUploadUrl: (fileName) => `/uploads/${fileName}`,
      getStorageObjectBuffer,
      getVariantsAbsoluteDir: (fileName) => `C:/tmp/${fileName}`,
      getVariantsRelativeDir: (fileName) => `variants/${fileName}`,
      imagePipelineWidths: [320],
      isOriginalUploadFileName: (value) => String(value).endsWith('.jpg'),
      isRemoteStorage: true,
      listRemoteObjectsByPrefix,
      loadSharp: async () => null,
      putStorageObject: vi.fn(async () => {}),
      toUploadsStorageKey: (value) => `uploads/${value}`,
      toUploadsUrlFromRelative: (value) => `/uploads/${value}`,
      uploadsDir: 'C:/tmp/uploads',
    });

    const items = await service.listMediaFiles();
    const status = await service.getImagePipelineStatus();

    expect(items).toHaveLength(1);
    expect(status).toEqual(expect.objectContaining({
      total: 1,
      ready: 1,
      pending: 0,
      engine: 'disabled',
    }));
    expect(listRemoteObjectsByPrefix).toHaveBeenCalledTimes(2);
    expect(getStorageObjectBuffer).not.toHaveBeenCalled();

    service.invalidateMediaLibrarySnapshot();
    await service.getImagePipelineStatus();
    expect(listRemoteObjectsByPrefix).toHaveBeenCalledTimes(4);
  });

  it('does not cache stale media snapshots after invalidation during an in-flight build', async () => {
    let releaseListing;
    const firstListing = new Promise((resolve) => {
      releaseListing = resolve;
    });
    const listRemoteObjectsByPrefix = vi
      .fn()
      .mockImplementationOnce(async (prefix) => {
        expect(prefix).toBe('uploads/');
        return firstListing;
      })
      .mockImplementationOnce(async (prefix) => {
        expect(prefix).toBe('uploads/_variants/');
        return [];
      })
      .mockImplementationOnce(async (prefix) => {
        expect(prefix).toBe('uploads/');
        return [
          {
            Key: 'uploads/fresh.jpg',
            Size: 2048,
            LastModified: '2026-04-15T10:10:00.000Z',
          },
        ];
      })
      .mockImplementationOnce(async (prefix) => {
        expect(prefix).toBe('uploads/_variants/');
        return [
          {
            Key: 'uploads/_variants/fresh/manifest.json',
            Size: 320,
            LastModified: '2026-04-15T10:10:01.000Z',
          },
        ];
      });
    const getStorageObjectBuffer = vi.fn(async () => null);

    const service = createImagePipelineService({
      Article: { updateMany: vi.fn(async () => ({ modifiedCount: 0 })) },
      Tip: { updateMany: vi.fn(async () => ({ modifiedCount: 0 })) },
      allowedImageExtensions: new Set(['.jpg', '.png', '.webp']),
      getManifestAbsolutePath: (fileName) => `C:/tmp/${fileName}/manifest.json`,
      getManifestRelativePath: (fileName) => `variants/${fileName}/manifest.json`,
      getOriginalUploadUrl: (fileName) => `/uploads/${fileName}`,
      getStorageObjectBuffer,
      getVariantsAbsoluteDir: (fileName) => `C:/tmp/${fileName}`,
      getVariantsRelativeDir: (fileName) => `variants/${fileName}`,
      imagePipelineWidths: [320],
      isOriginalUploadFileName: (value) => String(value).endsWith('.jpg'),
      isRemoteStorage: true,
      listRemoteObjectsByPrefix,
      loadSharp: async () => null,
      putStorageObject: vi.fn(async () => {}),
      toUploadsStorageKey: (value) => `uploads/${value}`,
      toUploadsUrlFromRelative: (value) => `/uploads/${value}`,
      uploadsDir: 'C:/tmp/uploads',
    });

    const firstSnapshotPromise = service.getMediaLibrarySnapshot();
    service.invalidateMediaLibrarySnapshot();
    releaseListing([
      {
        Key: 'uploads/stale.jpg',
        Size: 1024,
        LastModified: '2026-04-15T10:00:00.000Z',
      },
    ]);
    await firstSnapshotPromise;

    const freshSnapshot = await service.getMediaLibrarySnapshot();
    expect(freshSnapshot.items).toHaveLength(1);
    expect(freshSnapshot.items[0]?.name).toBe('fresh.jpg');
    expect(freshSnapshot.items[0]?.pipelineReady).toBe(true);
    expect(listRemoteObjectsByPrefix).toHaveBeenCalledTimes(4);
    expect(getStorageObjectBuffer).not.toHaveBeenCalled();
  });

  it('deduplicates uploads in memory and enforces auth permissions', async () => {
    const dedup = createUploadDedupService({ recentUploadCacheMax: 1, recentUploadTtlMs: 50 });
    const fingerprint = dedup.makeUploadFingerprint(Buffer.from('same-file'), 'image/jpeg', true);
    dedup.rememberRecentUploadPayload(fingerprint, { ok: true });
    expect(dedup.getRecentUploadPayload(fingerprint)).toEqual({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(dedup.getRecentUploadPayload(fingerprint)).toBeNull();

    const authz = createAuthzService({
      decodeTokenFromRequest: (req) => req.token || null,
      hasPermissionForSection: async (user, section) => user?.sections?.includes(section),
      publicError: (error) => error.message,
    });

    const unauthRes = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
    authz.requireAuth({}, unauthRes, vi.fn());
    expect(unauthRes.statusCode).toBe(401);

    const next = vi.fn();
    const req = { token: { role: 'admin', sections: ['permissions'] } };
    const okRes = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
    authz.requireAuth(req, okRes, next);
    expect(next).toHaveBeenCalled();

    const permissionNext = vi.fn();
    await authz.requirePermission('permissions')(req, okRes, permissionNext);
    expect(permissionNext).toHaveBeenCalled();
  });
});
