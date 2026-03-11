import { createHash } from 'node:crypto';

export function createShareCardRuntimeHelpers({
  brandLogoPng,
  buildArticleSnapshot,
  buildShareCardModel,
  buildShareCardOverlaySvg,
  deleteRemoteKeys,
  fs,
  getDiskAbsolutePath,
  getOriginalUploadUrl,
  getShareRelativePath,
  getShareSourceUrl,
  getUploadFilenameFromUrl,
  isRemoteStorage,
  listRemoteObjectsByPrefix,
  loadSharp,
  normalizeText,
  path,
  putStorageObject,
  readOriginalUploadBuffer,
  renderTextImage,
  resolveSharePalette,
  shareCardsDir,
  shareCardHeight,
  shareCardWidth,
  storageObjectExists,
  storageUploadsPrefix,
  toUploadsStorageKey,
  toUploadsUrlFromRelative,
  uploadsDir,
  fetchImpl = globalThis.fetch,
}) {
  async function resolveShareBackgroundInput(article) {
    const sourceUrl = getShareSourceUrl(article);
    if (!sourceUrl) return null;

    const uploadFileName = getUploadFilenameFromUrl(sourceUrl);
    if (uploadFileName) {
      const buffer = await readOriginalUploadBuffer(uploadFileName);
      if (buffer && buffer.byteLength > 0) return buffer;
      return null;
    }

    if (!/^https?:\/\//i.test(sourceUrl)) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const response = await fetchImpl(sourceUrl, {
        signal: controller.signal,
        headers: { Accept: 'image/*' },
      });
      clearTimeout(timeout);
      if (!response.ok) return null;
      const contentType = normalizeText(response.headers.get('content-type') || '', 80).toLowerCase();
      if (!contentType.startsWith('image/')) return null;
      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength < 256) return null;
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }

  async function cleanupOldShareCards(articleId, keepFileName) {
    try {
      const prefix = `article-${articleId}-`;
      if (isRemoteStorage) {
        const prefixKey = toUploadsStorageKey(path.posix.join('_share', prefix));
        const objects = await listRemoteObjectsByPrefix(prefixKey);
        const staleKeys = objects
          .map(item => String(item?.Key || ''))
          .filter(Boolean)
          .filter((key) => {
            const relative = key.startsWith(`${storageUploadsPrefix}/`) ? key.slice(`${storageUploadsPrefix}/`.length) : key;
            return !relative.endsWith(`/${keepFileName}`) && !relative.endsWith(keepFileName);
          });
        await deleteRemoteKeys(staleKeys);
        return;
      }

      const entries = await fs.promises.readdir(shareCardsDir, { withFileTypes: true });
      await Promise.all(entries
        .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name !== keepFileName)
        .map((entry) => fs.promises.unlink(path.join(shareCardsDir, entry.name)).catch(() => { })));
    } catch {
      // ignore cleanup errors
    }
  }

  async function ensureArticleShareCard(article, { categoryLabel = '' } = {}) {
    const sharp = await loadSharp();
    if (!sharp || !article || !Number.isInteger(Number.parseInt(article.id, 10))) return null;

    const normalized = {
      ...buildArticleSnapshot(article),
      id: Number.parseInt(article.id, 10),
    };
    const model = buildShareCardModel(normalized, categoryLabel);
    const imageSource = getShareSourceUrl(normalized);
    const signature = createHash('sha1')
      .update(JSON.stringify({
        v: 'share-card-v24-brand-logo',
        id: normalized.id,
        title: normalized.title,
        excerpt: normalized.excerpt,
        content: normalized.content,
        category: normalized.category,
        date: normalized.date,
        breaking: normalized.breaking,
        shareTitle: normalized.shareTitle,
        shareSubtitle: normalized.shareSubtitle,
        shareBadge: normalized.shareBadge,
        shareAccent: normalized.shareAccent,
        shareImage: normalized.shareImage,
        image: normalized.image,
        imageSource,
        categoryLabel,
      }))
      .digest('hex')
      .slice(0, 14);

    const fileName = `article-${normalized.id}-${signature}.png`;
    const relativePath = getShareRelativePath(fileName);
    const absolutePath = isRemoteStorage ? null : getDiskAbsolutePath(relativePath);
    const url = toUploadsUrlFromRelative(relativePath);

    if (await storageObjectExists(relativePath)) {
      return { generated: true, fileName, absolutePath, relativePath, url };
    }

    const backgroundInput = await resolveShareBackgroundInput(normalized);
    const overlaySvg = Buffer.from(buildShareCardOverlaySvg(model), 'utf8');

    const titleText = model.titleLines.join('\n');
    const subtitleText = model.subtitleLines.join('\n');

    const [badge, title, subtitle, category, date] = await Promise.all([
      renderTextImage(sharp, model.badge, {
        fontSize: model.badgeFontSize,
        fontWeight: '900',
        color: 'white',
        width: model.badgeWidth - 30,
        height: model.badgeHeight,
        align: 'centre',
      }),
      renderTextImage(sharp, titleText, {
        fontSize: model.titleFontSize,
        fontWeight: '900',
        color: 'white',
        width: shareCardWidth - 200,
        height: 220,
      }),
      renderTextImage(sharp, subtitleText, {
        fontSize: model.subtitleFontSize,
        fontWeight: 'bold',
        color: '#f5f2fb',
        width: shareCardWidth - 210,
        height: 80,
      }),
      renderTextImage(sharp, model.category, {
        fontSize: model.categoryFontSize * 0.75,
        fontWeight: '900',
        color: model.palette.ink,
        width: model.categoryChipWidth - 40,
        height: 44,
        align: 'centre',
      }),
      model.dateLabel
        ? renderTextImage(sharp, model.dateLabel, {
          fontSize: 18,
          fontWeight: 'bold',
          color: '#3f2d56',
          width: 190,
          height: 26,
        })
        : null,
    ]);

    const composites = [{ input: overlaySvg }];

    if (badge) composites.push({
      input: badge.buffer,
      top: Math.round(54 + (model.badgeHeight - badge.height) / 2),
      left: Math.round(72 + (model.badgeWidth - badge.width) / 2),
    });

    if (title) {
      const zoneTop = 148, zoneH = 246;
      composites.push({
        input: title.buffer,
        top: Math.max(zoneTop, Math.round(zoneTop + (zoneH - title.height) / 2)),
        left: 94,
      });
    }

    if (subtitle) composites.push({
      input: subtitle.buffer,
      top: Math.round(398 + (96 - subtitle.height) / 2),
      left: 96,
    });

    if (category) composites.push({
      input: category.buffer,
      top: Math.round(540 + (50 - category.height) / 2),
      left: Math.round(78 + (model.categoryChipWidth - category.width) / 2),
    });

    {
      const footerRight = shareCardWidth - 56;
      let brandW = 0, brandH = 0;
      if (brandLogoPng) {
        const meta = await sharp(brandLogoPng).metadata();
        brandW = meta.width || 0;
        brandH = meta.height || 0;
      }
      const stackH = brandH + (date ? date.height - 2 : 0);
      const stackTop = Math.round(522 + (86 - stackH) / 2);
      if (brandLogoPng) composites.push({
        input: brandLogoPng,
        top: stackTop,
        left: Math.round(footerRight - brandW - 16),
      });
      if (date) composites.push({
        input: date.buffer,
        top: stackTop + brandH - 2,
        left: Math.round(footerRight - date.width - 16),
      });
    }

    let baseImage;
    if (backgroundInput) {
      baseImage = sharp(backgroundInput, { failOn: 'none' })
        .rotate()
        .resize(shareCardWidth, shareCardHeight, { fit: 'cover', position: 'centre' })
        .modulate({ brightness: 0.8, saturation: 1.1 });
    } else {
      const bg = resolveSharePalette(normalized);
      baseImage = sharp({
        create: {
          width: shareCardWidth,
          height: shareCardHeight,
          channels: 3,
          background: bg.primary,
        },
      });
    }

    const output = await baseImage
      .composite(composites)
      .png({ compressionLevel: 9, quality: 92 })
      .toBuffer();

    await putStorageObject(relativePath, output, 'image/png');
    await cleanupOldShareCards(normalized.id, fileName);
    return { generated: true, fileName, absolutePath, relativePath, url };
  }

  async function resolveShareFallbackSource(article) {
    const sourceUrl = getShareSourceUrl(article);
    if (!sourceUrl) return null;
    const uploadFileName = getUploadFilenameFromUrl(sourceUrl);
    if (uploadFileName) {
      if (isRemoteStorage) {
        const exists = await storageObjectExists(uploadFileName);
        if (!exists) return null;
        return { type: 'redirect', url: getOriginalUploadUrl(uploadFileName) };
      }

      const fullPath = path.join(uploadsDir, uploadFileName);
      try {
        await fs.promises.access(fullPath, fs.constants.R_OK);
        return { type: 'file', path: fullPath };
      } catch {
        return null;
      }
    }
    if (/^https?:\/\//i.test(sourceUrl)) return { type: 'redirect', url: sourceUrl };
    return null;
  }

  function getPublicBaseUrl(req) {
    const configured = normalizeText(process.env.PUBLIC_BASE_URL, 240);
    if (configured) return configured.replace(/\/+$/, '');
    const forwardedProto = normalizeText(req.headers['x-forwarded-proto'], 16).toLowerCase();
    const protocol = forwardedProto === 'https' ? 'https' : (req.protocol || 'http');
    const host = normalizeText(req.get('host'), 180);
    return host ? `${protocol}://${host}` : '';
  }

  return {
    cleanupOldShareCards,
    ensureArticleShareCard,
    getPublicBaseUrl,
    resolveShareBackgroundInput,
    resolveShareFallbackSource,
  };
}
