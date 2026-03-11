export function createShareCardRuntimeHelpers({
  brandLogoPng,
  buildShareCardModel,
  buildShareCardOverlaySvg,
  buildShareCardStorageTarget,
  cleanupOldShareCards,
  hasShareCardObject,
  loadSharp,
  normalizeText,
  persistShareCardObject,
  renderTextImage,
  resolveShareBackgroundInput,
  resolveShareFallbackSource,
  resolveSharePalette,
  shareCardHeight,
  shareCardWidth,
}) {
  async function ensureArticleShareCard(article, { categoryLabel = '' } = {}) {
    const sharp = await loadSharp();
    if (!sharp || !article || !Number.isInteger(Number.parseInt(article.id, 10))) return null;

    const target = buildShareCardStorageTarget(article, { categoryLabel });
    const { normalized } = target;
    const model = buildShareCardModel(normalized, categoryLabel);

    if (await hasShareCardObject(target)) {
      return {
        absolutePath: target.absolutePath,
        fileName: target.fileName,
        generated: true,
        relativePath: target.relativePath,
        url: target.url,
      };
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
      const zoneTop = 148;
      const zoneH = 246;
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
      let brandW = 0;
      let brandH = 0;
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

    await persistShareCardObject(target, output);
    await cleanupOldShareCards(normalized.id, target.fileName);
    return {
      absolutePath: target.absolutePath,
      fileName: target.fileName,
      generated: true,
      relativePath: target.relativePath,
      url: target.url,
    };
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
