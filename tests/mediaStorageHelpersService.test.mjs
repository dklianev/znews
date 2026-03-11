import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createMediaStorageHelpers } from '../server/services/mediaStorageHelpersService.js';

function createHelpers(overrides = {}) {
  return createMediaStorageHelpers({
    bundledFontFile: 'C:/fonts/NotoSans.ttf',
    escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    fs,
    getDiskAbsolutePath(relativePath) {
      return path.join('C:/uploads', ...String(relativePath || '').split('/').filter(Boolean));
    },
    imageMimeToExt: {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    },
    path,
    ...overrides,
  });
}

export async function runMediaStorageHelpersTests() {
  const helpers = createHelpers({
    dateNow: () => 1700000000000,
    random: () => 0.123456,
  });

  assert.equal(helpers.isSafeUploadFilename('photo-1.webp'), true);
  assert.equal(helpers.isSafeUploadFilename('../photo.webp'), false);
  assert.equal(helpers.isOriginalUploadFileName('photo.webp'), true);
  assert.equal(helpers.isOriginalUploadFileName('_share-card.png'), false);
  assert.equal(helpers.isOriginalUploadFileName('photo-w768.webp'), false);
  assert.equal(helpers.isOriginalUploadFileName('photo-avif.webp'), false);
  assert.equal(helpers.isOriginalUploadFileName('photo-webp.jpg'), false);

  assert.equal(helpers.getVariantsRelativeDir('photo.webp'), '_variants/photo');
  assert.equal(helpers.getVariantsAbsoluteDir('photo.webp'), path.join('C:/uploads', '_variants', 'photo'));
  assert.equal(helpers.getManifestRelativePath('photo.webp'), '_variants/photo/manifest.json');
  assert.equal(helpers.getManifestAbsolutePath('photo.webp'), path.join('C:/uploads', '_variants', 'photo', 'manifest.json'));
  assert.equal(helpers.getShareRelativePath('article-1.png'), '_share/article-1.png');
  assert.equal(helpers.createUploadFileName('image/png'), '1700000000000-123456.png');
  assert.equal(helpers.createUploadFileName('image/unknown'), '1700000000000-123456.jpg');

  const directBuffer = Buffer.from('direct');
  assert.equal(await helpers.readSdkBodyToBuffer(directBuffer), directBuffer);
  assert.deepEqual(
    await helpers.readSdkBodyToBuffer({ transformToByteArray: async () => Uint8Array.from([65, 66, 67]) }),
    Buffer.from('ABC')
  );
  assert.deepEqual(
    await helpers.readSdkBodyToBuffer((async function* () {
      yield Buffer.from('A');
      yield Uint8Array.from([66, 67]);
    })()),
    Buffer.from('ABC')
  );

  assert.equal(helpers.isStorageNotFoundError({ $metadata: { httpStatusCode: 404 } }), true);
  assert.equal(helpers.isStorageNotFoundError({ code: 'NoSuchKey' }), true);
  assert.equal(helpers.isStorageNotFoundError({ name: 'BlobNotFound' }), true);
  assert.equal(helpers.isStorageNotFoundError({ code: 'Other' }), false);

  let importCalls = 0;
  const sharpModule = { default: { marker: 'sharp' } };
  const loaderHelpers = createHelpers({
    importSharp: async () => {
      importCalls += 1;
      return sharpModule;
    },
  });
  const sharpOne = await loaderHelpers.loadSharp();
  const sharpTwo = await loaderHelpers.loadSharp();
  assert.equal(sharpOne, sharpModule.default);
  assert.equal(sharpTwo, sharpModule.default);
  assert.equal(importCalls, 1);

  let warnings = 0;
  const failingHelpers = createHelpers({
    importSharp: async () => {
      throw new Error('missing');
    },
    logWarning() {
      warnings += 1;
    },
  });
  assert.equal(await failingHelpers.loadSharp(), null);
  assert.equal(await failingHelpers.loadSharp(), null);
  assert.equal(warnings, 1);

  let capturedInput = null;
  const rendered = await helpers.renderTextImage((input) => {
    capturedInput = input;
    return {
      png() {
        return this;
      },
      async toBuffer() {
        return {
          data: Buffer.from('png'),
          info: { width: 321, height: 87 },
        };
      },
    };
  }, 'Title <b>& more', {
    fontSize: 52,
    fontWeight: '900',
    color: '#fff',
    width: 600,
    height: 120,
    align: 'centre',
  });
  assert.deepEqual(rendered, { buffer: Buffer.from('png'), width: 321, height: 87 });
  assert.equal(capturedInput.text.fontfile, 'C:/fonts/NotoSans.ttf');
  assert.equal(capturedInput.text.align, 'centre');
  assert.match(capturedInput.text.text, /font_weight="bold"/);
  assert.match(capturedInput.text.text, /Title &lt;b&gt;&amp; more/);

  const noFontHelpers = createHelpers({ bundledFontFile: '' });
  assert.equal(await noFontHelpers.renderTextImage(() => {
    throw new Error('should not render without font');
  }, 'Hello'), null);
  assert.equal(await helpers.renderTextImage(() => {
    throw new Error('should not render empty text');
  }, ''), null);
}
