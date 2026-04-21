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

  it('repairs crop-only image meta during backfill without dropping focal settings', async () => {
    const articleFind = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: 'article-1',
            imageMeta: {
              objectPosition: '33% 66%',
              objectScale: 1.2,
            },
          },
        ]),
      }),
    });
    const articleBulkWrite = vi.fn(async () => ({ modifiedCount: 1 }));
    const tipFind = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });
    const tipBulkWrite = vi.fn(async () => ({ modifiedCount: 0 }));

    const service = createImagePipelineService({
      Article: {
        find: articleFind,
        bulkWrite: articleBulkWrite,
      },
      Tip: {
        find: tipFind,
        bulkWrite: tipBulkWrite,
      },
      allowedImageExtensions: new Set(['.jpg', '.png', '.webp']),
      getManifestAbsolutePath: (fileName) => `C:/tmp/${fileName}/manifest.json`,
      getManifestRelativePath: (fileName) => `variants/${fileName}/manifest.json`,
      getOriginalUploadUrl: (fileName) => `/uploads/${fileName}`,
      getStorageObjectBuffer: async (key) => {
        if (!key.endsWith('manifest.json')) return null;
        return Buffer.from(JSON.stringify({
          original: { width: 1600, height: 900, format: 'webp' },
          placeholder: '/uploads/_variants/hero/blur.webp',
          variants: [
            { width: 640, webp: '/uploads/_variants/hero/w640.webp', avif: '/uploads/_variants/hero/w640.avif' },
          ],
        }), 'utf8');
      },
      getVariantsAbsoluteDir: (fileName) => `C:/tmp/${fileName}`,
      getVariantsRelativeDir: (fileName) => `variants/${fileName}`,
      imagePipelineWidths: [320, 640],
      isOriginalUploadFileName: (value) => String(value).endsWith('.jpg'),
      isRemoteStorage: true,
      listRemoteObjectsByPrefix: async (prefix) => (
        prefix === 'uploads/'
          ? [{ Key: 'uploads/hero.jpg', Size: 1024, LastModified: '2026-04-19T10:00:00.000Z' }]
          : []
      ),
      loadSharp: async () => (() => ({})),
      putStorageObject: vi.fn(async () => {}),
      toUploadsStorageKey: (value) => `uploads/${value}`,
      toUploadsUrlFromRelative: (value) => `/uploads/${value}`,
      uploadsDir: 'C:/tmp/uploads',
    });

    const summary = await service.backfillImagePipeline({ force: false });

    expect(summary.skipped).toBe(1);
    expect(summary.syncedArticleMeta).toBe(1);
    expect(articleFind).toHaveBeenCalledWith({
      image: { $in: ['/uploads/hero.jpg'] },
      $or: [
        { imageMeta: { $exists: false } },
        { imageMeta: null },
        { 'imageMeta.width': { $exists: false } },
        { 'imageMeta.height': { $exists: false } },
        { 'imageMeta.placeholder': { $exists: false } },
        { 'imageMeta.placeholder': '' },
        { 'imageMeta.webp.0': { $exists: false } },
        { 'imageMeta.avif.0': { $exists: false } },
      ],
    });
    expect(articleBulkWrite).toHaveBeenCalledTimes(1);
    expect(articleBulkWrite.mock.calls[0][0]).toEqual([
      {
        updateOne: {
          filter: { _id: 'article-1' },
          update: {
            $set: {
              imageMeta: {
                width: 1600,
                height: 900,
                placeholder: '/uploads/_variants/hero/blur.webp',
                webp: [{ width: 640, url: '/uploads/_variants/hero/w640.webp' }],
                avif: [{ width: 640, url: '/uploads/_variants/hero/w640.avif' }],
                objectPosition: '33% 66%',
                objectScale: 1.2,
              },
            },
          },
        },
      },
    ]);
  });

  it('self-heals article image meta with cached manifest reads and one bulk write', async () => {
    const articleBulkWrite = vi.fn(async () => ({ modifiedCount: 2 }));
    const getStorageObjectBuffer = vi.fn(async (key) => {
      expect(key).toBe('variants/hero.jpg/manifest.json');
      return Buffer.from(JSON.stringify({
        original: { width: 1400, height: 900, format: 'jpg' },
        placeholder: '/uploads/_variants/hero/blur.webp',
        variants: [
          { width: 640, webp: '/uploads/_variants/hero/w640.webp', avif: '/uploads/_variants/hero/w640.avif' },
        ],
      }), 'utf8');
    });
    const warn = vi.fn();

    const service = createImagePipelineService({
      Article: { bulkWrite: articleBulkWrite },
      Tip: { updateMany: vi.fn(async () => ({ modifiedCount: 0 })) },
      allowedImageExtensions: new Set(['.jpg', '.png', '.webp']),
      getManifestAbsolutePath: (fileName) => `C:/tmp/${fileName}/manifest.json`,
      getManifestRelativePath: (fileName) => `variants/${fileName}/manifest.json`,
      getOriginalUploadUrl: (fileName) => `/uploads/${fileName}`,
      getStorageObjectBuffer,
      getVariantsAbsoluteDir: (fileName) => `C:/tmp/${fileName}`,
      getVariantsRelativeDir: (fileName) => `variants/${fileName}`,
      imagePipelineWidths: [320, 640],
      isOriginalUploadFileName: (value) => String(value).endsWith('.jpg'),
      isRemoteStorage: true,
      listRemoteObjectsByPrefix: async () => [],
      loadSharp: async () => null,
      logWarn: warn,
      putStorageObject: vi.fn(async () => {}),
      toUploadsStorageKey: (value) => `uploads/${value}`,
      toUploadsUrlFromRelative: (value) => `/uploads/${value}`,
      uploadsDir: 'C:/tmp/uploads',
    });

    const items = [
      {
        id: 101,
        image: '/uploads/hero.jpg',
        imageMeta: { objectPosition: '33% 66%' },
      },
      {
        id: 102,
        image: '/uploads/hero.jpg',
        imageMeta: { objectScale: 1.2 },
      },
    ];

    await service.selfHealArticleImageMeta(items);

    expect(getStorageObjectBuffer).toHaveBeenCalledTimes(1);
    expect(items[0].imageMeta).toEqual({
      width: 1400,
      height: 900,
      placeholder: '/uploads/_variants/hero/blur.webp',
      webp: [{ width: 640, url: '/uploads/_variants/hero/w640.webp' }],
      avif: [{ width: 640, url: '/uploads/_variants/hero/w640.avif' }],
      objectPosition: '33% 66%',
    });
    expect(items[1].imageMeta).toEqual({
      width: 1400,
      height: 900,
      placeholder: '/uploads/_variants/hero/blur.webp',
      webp: [{ width: 640, url: '/uploads/_variants/hero/w640.webp' }],
      avif: [{ width: 640, url: '/uploads/_variants/hero/w640.avif' }],
      objectScale: 1.2,
    });
    expect(articleBulkWrite).toHaveBeenCalledTimes(1);
    expect(articleBulkWrite.mock.calls[0][0]).toEqual([
      {
        updateOne: {
          filter: { id: 101 },
          update: { $set: { imageMeta: items[0].imageMeta } },
        },
      },
      {
        updateOne: {
          filter: { id: 102 },
          update: { $set: { imageMeta: items[1].imageMeta } },
        },
      },
    ]);
    expect(articleBulkWrite.mock.calls[0][1]).toEqual({ ordered: false });
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not block public responses on slow image meta lookups', async () => {
    const articleBulkWrite = vi.fn(async () => ({ modifiedCount: 1 }));
    const releaseManifest = new Promise((resolve) => {
      setTimeout(() => {
        resolve(Buffer.from(JSON.stringify({
          original: { width: 1400, height: 900, format: 'jpg' },
          variants: [],
        }), 'utf8'));
      }, 20);
    });

    const service = createImagePipelineService({
      Article: { bulkWrite: articleBulkWrite },
      Tip: { updateMany: vi.fn(async () => ({ modifiedCount: 0 })) },
      allowedImageExtensions: new Set(['.jpg', '.png', '.webp']),
      getManifestAbsolutePath: (fileName) => `C:/tmp/${fileName}/manifest.json`,
      getManifestRelativePath: (fileName) => `variants/${fileName}/manifest.json`,
      getOriginalUploadUrl: (fileName) => `/uploads/${fileName}`,
      getStorageObjectBuffer: vi.fn(async () => releaseManifest),
      getVariantsAbsoluteDir: (fileName) => `C:/tmp/${fileName}`,
      getVariantsRelativeDir: (fileName) => `variants/${fileName}`,
      imagePipelineWidths: [320, 640],
      isOriginalUploadFileName: (value) => String(value).endsWith('.jpg'),
      isRemoteStorage: true,
      listRemoteObjectsByPrefix: async () => [],
      loadSharp: async () => null,
      logWarn: vi.fn(),
      putStorageObject: vi.fn(async () => {}),
      toUploadsStorageKey: (value) => `uploads/${value}`,
      toUploadsUrlFromRelative: (value) => `/uploads/${value}`,
      uploadsDir: 'C:/tmp/uploads',
    });

    const item = {
      id: 103,
      image: '/uploads/slow.jpg',
      imageMeta: { objectPosition: '50% 50%' },
    };

    await service.selfHealArticleImageMeta(item, { resolveBudgetMs: 1 });

    expect(item.imageMeta).toEqual({ objectPosition: '50% 50%' });
    expect(articleBulkWrite).not.toHaveBeenCalled();
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
