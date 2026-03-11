import assert from 'node:assert/strict';
import path from 'node:path';
import { createShareCardRuntimeHelpers } from '../server/services/shareCardRuntimeService.js';

function createBaseDeps(overrides = {}) {
  return {
    brandLogoPng: null,
    buildArticleSnapshot(article) {
      return { ...article };
    },
    buildShareCardModel() {
      return {
        badge: 'EXCLUSIVE',
        badgeFontSize: 40,
        badgeWidth: 260,
        badgeHeight: 70,
        titleLines: ['TITLE'],
        subtitleLines: ['Subtitle'],
        titleFontSize: 72,
        subtitleFontSize: 30,
        category: 'CRIME',
        categoryFontSize: 40,
        categoryChipWidth: 320,
        dateLabel: '2026-03-11',
        palette: { primary: '#ef1f1f', ink: '#25162f' },
      };
    },
    buildShareCardOverlaySvg() {
      return '<svg />';
    },
    deleteRemoteKeys: async () => {},
    fs: {
      constants: { R_OK: 4 },
      promises: {
        access: async () => {},
        readdir: async () => [],
        unlink: async () => {},
      },
    },
    getDiskAbsolutePath(relativePath) {
      return path.join('C:/uploads', relativePath);
    },
    getOriginalUploadUrl(fileName) {
      return `https://cdn.example.com/${fileName}`;
    },
    getShareRelativePath(fileName) {
      return `_share/${fileName}`;
    },
    getShareSourceUrl() {
      return '';
    },
    getUploadFilenameFromUrl() {
      return '';
    },
    isRemoteStorage: false,
    listRemoteObjectsByPrefix: async () => [],
    loadSharp: async () => ({ metadata: async () => ({ width: 0, height: 0 }) }),
    normalizeText(value, maxLen = 255) {
      return String(value ?? '').trim().slice(0, maxLen);
    },
    path,
    putStorageObject: async () => {},
    readOriginalUploadBuffer: async () => null,
    renderTextImage: async () => null,
    resolveSharePalette() {
      return { primary: '#ef1f1f' };
    },
    shareCardsDir: 'C:/uploads/_share',
    shareCardHeight: 630,
    shareCardWidth: 1200,
    storageObjectExists: async () => false,
    storageUploadsPrefix: 'uploads',
    toUploadsStorageKey(relativePath) {
      return `uploads/${relativePath}`;
    },
    toUploadsUrlFromRelative(relativePath) {
      return `/uploads/${relativePath}`;
    },
    uploadsDir: 'C:/uploads',
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => new Uint8Array(300).buffer,
    }),
    ...overrides,
  };
}

export async function runShareCardRuntimeHelpersTests() {
  const uploadHelpers = createShareCardRuntimeHelpers(createBaseDeps({
    getShareSourceUrl() {
      return '/uploads/share.png';
    },
    getUploadFilenameFromUrl() {
      return 'share.png';
    },
    readOriginalUploadBuffer: async (fileName) => Buffer.from(fileName),
  }));
  const uploadBuffer = await uploadHelpers.resolveShareBackgroundInput({ id: 7 });
  assert.equal(uploadBuffer.toString(), 'share.png');

  let fetchedUrl = '';
  const remoteHelpers = createShareCardRuntimeHelpers(createBaseDeps({
    getShareSourceUrl() {
      return 'https://example.com/share.png';
    },
    fetchImpl: async (url) => {
      fetchedUrl = url;
      return {
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => new Uint8Array(320).buffer,
      };
    },
  }));
  const remoteBuffer = await remoteHelpers.resolveShareBackgroundInput({ id: 8 });
  assert.equal(fetchedUrl, 'https://example.com/share.png');
  assert.equal(remoteBuffer.byteLength, 320);

  const nonImageHelpers = createShareCardRuntimeHelpers(createBaseDeps({
    getShareSourceUrl() {
      return 'https://example.com/not-image';
    },
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => 'text/html' },
      arrayBuffer: async () => new Uint8Array(320).buffer,
    }),
  }));
  assert.equal(await nonImageHelpers.resolveShareBackgroundInput({ id: 9 }), null);

  const deletedPaths = [];
  const cleanupHelpers = createShareCardRuntimeHelpers(createBaseDeps({
    fs: {
      constants: { R_OK: 4 },
      promises: {
        access: async () => {},
        readdir: async () => [
          { isFile: () => true, name: 'article-7-old.png' },
          { isFile: () => true, name: 'article-7-keep.png' },
          { isFile: () => true, name: 'article-8-other.png' },
        ],
        unlink: async (filePath) => {
          deletedPaths.push(filePath);
        },
      },
    },
  }));
  await cleanupHelpers.cleanupOldShareCards(7, 'article-7-keep.png');
  assert.deepEqual(deletedPaths, [path.join('C:/uploads/_share', 'article-7-old.png')]);

  const localFallbackHelpers = createShareCardRuntimeHelpers(createBaseDeps({
    getShareSourceUrl() {
      return '/uploads/source.png';
    },
    getUploadFilenameFromUrl() {
      return 'source.png';
    },
  }));
  assert.deepEqual(await localFallbackHelpers.resolveShareFallbackSource({ id: 10 }), {
    type: 'file',
    path: path.join('C:/uploads', 'source.png'),
  });

  const remoteFallbackHelpers = createShareCardRuntimeHelpers(createBaseDeps({
    isRemoteStorage: true,
    getShareSourceUrl() {
      return '/uploads/source.png';
    },
    getUploadFilenameFromUrl() {
      return 'source.png';
    },
    storageObjectExists: async () => true,
  }));
  assert.deepEqual(await remoteFallbackHelpers.resolveShareFallbackSource({ id: 11 }), {
    type: 'redirect',
    url: 'https://cdn.example.com/source.png',
  });

  const directFallbackHelpers = createShareCardRuntimeHelpers(createBaseDeps({
    getShareSourceUrl() {
      return 'https://example.com/direct.png';
    },
  }));
  assert.deepEqual(await directFallbackHelpers.resolveShareFallbackSource({ id: 12 }), {
    type: 'redirect',
    url: 'https://example.com/direct.png',
  });

  const originalBaseUrl = process.env.PUBLIC_BASE_URL;
  try {
    process.env.PUBLIC_BASE_URL = 'https://znews.live///';
    assert.equal(directFallbackHelpers.getPublicBaseUrl({ headers: {}, protocol: 'http', get: () => 'ignored' }), 'https://znews.live');
    delete process.env.PUBLIC_BASE_URL;
    assert.equal(directFallbackHelpers.getPublicBaseUrl({
      headers: { 'x-forwarded-proto': 'https' },
      protocol: 'http',
      get(header) {
        return header === 'host' ? 'example.com' : '';
      },
    }), 'https://example.com');
  } finally {
    if (originalBaseUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = originalBaseUrl;
  }

  let stored = false;
  const existingHelpers = createShareCardRuntimeHelpers(createBaseDeps({
    storageObjectExists: async () => true,
    putStorageObject: async () => {
      stored = true;
    },
  }));
  const existingCard = await existingHelpers.ensureArticleShareCard({
    id: 15,
    title: 'Existing card',
    category: 'crime',
    date: '2026-03-11',
  }, { categoryLabel: 'Crime' });
  assert.equal(existingCard.generated, true);
  assert.equal(existingCard.relativePath.startsWith('_share/article-15-'), true);
  assert.equal(existingCard.url.startsWith('/uploads/_share/article-15-'), true);
  assert.equal(stored, false);

  const noSharpHelpers = createShareCardRuntimeHelpers(createBaseDeps({
    loadSharp: async () => null,
  }));
  assert.equal(await noSharpHelpers.ensureArticleShareCard({ id: 20 }, {}), null);
}
