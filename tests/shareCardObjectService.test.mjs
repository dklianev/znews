import assert from 'node:assert/strict';
import path from 'node:path';
import { createShareCardObjectHelpers } from '../server/services/shareCardObjectService.js';

function createBaseDeps(overrides = {}) {
  return {
    buildArticleSnapshot(article) {
      return { ...article };
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
    normalizeText(value, maxLen = 255) {
      return String(value ?? '').trim().slice(0, maxLen);
    },
    path,
    putStorageObject: async () => {},
    readOriginalUploadBuffer: async () => null,
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

export async function runShareCardObjectHelpersTests() {
  const objectHelpers = createShareCardObjectHelpers(createBaseDeps({
    getShareSourceUrl() {
      return '/uploads/share.png';
    },
  }));
  const target = objectHelpers.buildShareCardStorageTarget({
    id: 15,
    title: 'Existing card',
    category: 'crime',
    date: '2026-03-11',
  }, { categoryLabel: 'Crime' });
  assert.equal(target.fileName.startsWith('article-15-'), true);
  assert.equal(target.relativePath.startsWith('_share/article-15-'), true);
  assert.equal(target.absolutePath.startsWith('C:'), true);
  assert.equal(target.url.startsWith('/uploads/_share/article-15-'), true);
  assert.equal(target.normalized.id, 15);
  assert.equal(target.imageSource, '/uploads/share.png');

  const uploadHelpers = createShareCardObjectHelpers(createBaseDeps({
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
  const remoteHelpers = createShareCardObjectHelpers(createBaseDeps({
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

  const nonImageHelpers = createShareCardObjectHelpers(createBaseDeps({
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
  const cleanupHelpers = createShareCardObjectHelpers(createBaseDeps({
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

  const localFallbackHelpers = createShareCardObjectHelpers(createBaseDeps({
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

  const remoteFallbackHelpers = createShareCardObjectHelpers(createBaseDeps({
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

  const directFallbackHelpers = createShareCardObjectHelpers(createBaseDeps({
    getShareSourceUrl() {
      return 'https://example.com/direct.png';
    },
  }));
  assert.deepEqual(await directFallbackHelpers.resolveShareFallbackSource({ id: 12 }), {
    type: 'redirect',
    url: 'https://example.com/direct.png',
  });

  let persisted = null;
  const persistHelpers = createShareCardObjectHelpers(createBaseDeps({
    putStorageObject: async (relativePath, body, contentType) => {
      persisted = { relativePath, body: String(body), contentType };
    },
  }));
  await persistHelpers.persistShareCardObject({ relativePath: '_share/card.png' }, Buffer.from('png'));
  assert.deepEqual(persisted, {
    relativePath: '_share/card.png',
    body: 'png',
    contentType: 'image/png',
  });

  const existsHelpers = createShareCardObjectHelpers(createBaseDeps({
    storageObjectExists: async (relativePath) => relativePath === '_share/card.png',
  }));
  assert.equal(await existsHelpers.hasShareCardObject({ relativePath: '_share/card.png' }), true);
  assert.equal(await existsHelpers.hasShareCardObject({ relativePath: '_share/missing.png' }), false);
}
