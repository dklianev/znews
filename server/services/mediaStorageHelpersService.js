export function createMediaStorageHelpers({
  bundledFontFile,
  escapeHtml,
  fs,
  getDiskAbsolutePath,
  imageMimeToExt,
  importSharp = () => import('sharp'),
  logWarning = (...args) => console.warn(...args),
  path,
  dateNow = () => Date.now(),
  random = () => Math.random(),
}) {
  let sharpLoaderPromise = null;

  function defaultEscapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const escape = typeof escapeHtml === 'function' ? escapeHtml : defaultEscapeHtml;
  let sharpMissingWarned = false;

  function isSafeUploadFilename(name) {
    return /^[a-zA-Z0-9._-]+$/.test(name || '');
  }

  function isOriginalUploadFileName(name) {
    if (!isSafeUploadFilename(name)) return false;
    if (name.startsWith('_')) return false;
    return !name.includes('-w') && !name.includes('-avif') && !name.includes('-webp');
  }

  function getVariantsRelativeDir(fileName) {
    return path.posix.join('_variants', path.parse(fileName).name);
  }

  function getVariantsAbsoluteDir(fileName) {
    return getDiskAbsolutePath(getVariantsRelativeDir(fileName));
  }

  function getManifestRelativePath(fileName) {
    return path.posix.join(getVariantsRelativeDir(fileName), 'manifest.json');
  }

  function getManifestAbsolutePath(fileName) {
    return getDiskAbsolutePath(getManifestRelativePath(fileName));
  }

  function getShareRelativePath(fileName) {
    return path.posix.join('_share', fileName);
  }

  async function loadSharp() {
    if (sharpLoaderPromise) return sharpLoaderPromise;
    sharpLoaderPromise = importSharp()
      .then((mod) => mod.default || mod)
      .catch(() => {
        if (!sharpMissingWarned) {
          sharpMissingWarned = true;
          logWarning('? Image pipeline is disabled because optional dependency "sharp" is not available.');
        }
        return null;
      });
    return sharpLoaderPromise;
  }

  function createUploadFileName(mimeType) {
    const ext = imageMimeToExt[mimeType] || '.jpg';
    return `${dateNow()}-${Math.round(random() * 1e6)}${ext}`;
  }

  async function readSdkBodyToBuffer(body) {
    if (!body) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    if (typeof body.transformToByteArray === 'function') {
      const bytes = await body.transformToByteArray();
      return Buffer.from(bytes);
    }

    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  function isStorageNotFoundError(error) {
    const code = error?.$metadata?.httpStatusCode;
    const name = String(error?.name || error?.Code || error?.code || '').toLowerCase();
    return code === 404 || name.includes('nosuchkey') || name.includes('notfound');
  }

  async function renderTextImage(sharp, text, {
    fontSize = 40,
    fontWeight = 'bold',
    color = 'white',
    width = 400,
    height = 80,
    align = 'left',
  } = {}) {
    if (!text || !bundledFontFile) return null;
    const pangoSize = Math.round(fontSize * 1024);
    const weightAttr = fontWeight === '900' || fontWeight === 'bold' ? ' font_weight="bold"' : '';
    const escapedText = escape(text);
    const markup = `<span foreground="${color}"${weightAttr} font_size="${pangoSize}">${escapedText}</span>`;
    try {
      const { data, info } = await sharp({
        text: {
          text: markup,
          fontfile: bundledFontFile,
          rgba: true,
          width,
          height,
          align,
        },
      })
        .png()
        .toBuffer({ resolveWithObject: true });
      return { buffer: data, width: info.width, height: info.height };
    } catch {
      return null;
    }
  }

  return {
    createUploadFileName,
    getManifestAbsolutePath,
    getManifestRelativePath,
    getShareRelativePath,
    getVariantsAbsoluteDir,
    getVariantsRelativeDir,
    isOriginalUploadFileName,
    isSafeUploadFilename,
    isStorageNotFoundError,
    loadSharp,
    readSdkBodyToBuffer,
    renderTextImage,
  };
}