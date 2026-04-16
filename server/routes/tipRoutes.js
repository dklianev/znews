import { createHash } from 'crypto';
import { createImageUploadErrorHelpers } from '../services/imageUploadErrorsService.js';

const TIP_ADMIN_PERMISSIONS = ['articles'];
const TIP_PRIORITY_VALUES = new Set(['low', 'normal', 'high', 'urgent']);

function normalizeAssignedEditor(normalizeText, value) {
  return normalizeText(value || '', 80);
}

function normalizeTags(normalizeText, rawValue) {
  const source = Array.isArray(rawValue)
    ? rawValue
    : typeof rawValue === 'string'
      ? rawValue.split(',')
      : [];

  const uniqueTags = [];
  source.forEach((entry) => {
    const normalized = normalizeText(entry || '', 24);
    if (!normalized) return;
    if (uniqueTags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) return;
    uniqueTags.push(normalized);
  });

  return uniqueTags.slice(0, 8);
}

function normalizeDueAt(rawValue) {
  if (rawValue == null || rawValue === '') return null;
  const normalized = String(rawValue).trim();
  if (!normalized) return null;

  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  const parsed = new Date(dateOnlyMatch ? `${normalized}T23:59:59.999` : normalized);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return parsed;
}

function getActorName(req, normalizeText) {
  const name = normalizeText(req?.user?.name || req?.user?.username || '', 80);
  return name || 'Редактор';
}

export function registerTipRoutes(app, deps) {
  const {
    AuditLog,
    Tip,
    ensureImagePipeline,
    getOriginalUploadUrl,
    getTrustedClientIp,
    imageMimeToExt,
    loadSharp,
    nextNumericId,
    normalizeText,
    putStorageObject,
    rateLimit,
    rateLimitKeyGenerator,
    requireAnyPermission,
    requireAuth,
    shouldSkipRateLimit,
    toImageMetaFromManifest,
    upload,
    uploadMaxFileSizeMb,
  } = deps;
  const {
    buildEmptyBufferPayload,
    buildUploadErrorPayload,
  } = createImageUploadErrorHelpers({ uploadMaxFileSizeMb });

  function buildTipAuditDetails(update) {
    const parts = [];
    if (typeof update.status === 'string' && update.status) parts.push(`status:${update.status}`);
    if (typeof update.assignedEditor === 'string' && update.assignedEditor) parts.push(`editor:${update.assignedEditor}`);
    if (typeof update.priority === 'string' && update.priority) parts.push(`priority:${update.priority}`);
    if (Array.isArray(update.tags) && update.tags.length > 0) parts.push(`tags:${update.tags.join('|')}`);
    if (update.dueAt instanceof Date && Number.isFinite(update.dueAt.getTime())) {
      parts.push(`due:${update.dueAt.toISOString().slice(0, 10)}`);
    }
    return parts.join(' | ') || 'update';
  }

  const tipRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { error: 'Too many tip submissions from this IP. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    keyGenerator: rateLimitKeyGenerator,
  });

  function runSingleUpload(req, res) {
    return new Promise((resolve, reject) => {
      upload.single('image')(req, res, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  app.get('/api/tips', requireAuth, requireAnyPermission(TIP_ADMIN_PERMISSIONS), async (_req, res) => {
    const tips = await Tip.find().sort({ createdAt: -1 }).limit(500).lean();
    res.json(tips);
  });

  app.post('/api/tips', tipRateLimiter, async (req, res) => {
    try {
      await runSingleUpload(req, res);
    } catch (error) {
      return res.status(400).json(buildUploadErrorPayload(error));
    }

    let imageUrl = '';
    let imageMeta = null;

    if (req.file) {
      if (!Buffer.isBuffer(req.file.buffer) || req.file.buffer.byteLength === 0) {
        return res.status(400).json(buildEmptyBufferPayload());
      }

      const sharp = await loadSharp();
      const mimeType = normalizeText(req.file.mimetype || '', 120).toLowerCase();

      let finalBuffer = req.file.buffer;
      let finalName = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      let finalMime = mimeType;

      if (sharp) {
        finalBuffer = await sharp(req.file.buffer).rotate().webp({ quality: 82, effort: 4 }).toBuffer();
        finalName += '.webp';
        finalMime = 'image/webp';
      } else {
        finalName += (imageMimeToExt[mimeType] || '.jpg');
      }

      await putStorageObject(finalName, finalBuffer, finalMime || 'application/octet-stream');
      const pipelineManifest = await ensureImagePipeline(finalName, { sourceBuffer: finalBuffer });

      imageUrl = getOriginalUploadUrl(finalName);
      imageMeta = toImageMetaFromManifest(pipelineManifest);
    }

    const text = normalizeText(req.body.text || '', 2000);
    if (!text && !imageUrl) {
      return res.status(400).json({
        error: '\u0414\u043e\u0431\u0430\u0432\u0438 \u0442\u0435\u043a\u0441\u0442 \u0438\u043b\u0438 \u0441\u043d\u0438\u043c\u043a\u0430, \u0437\u0430 \u0434\u0430 \u0438\u0437\u043f\u0440\u0430\u0442\u0438\u0448 \u0441\u0438\u0433\u043d\u0430\u043b\u0430.',
        fieldErrors: {
          text: '\u0414\u043e\u0431\u0430\u0432\u0438 \u043f\u043e\u0434\u0440\u043e\u0431\u043d\u043e\u0441\u0442\u0438 \u0437\u0430 \u0441\u0438\u0433\u043d\u0430\u043b\u0430 \u0438\u043b\u0438 \u043a\u0430\u0447\u0438 \u0441\u043d\u0438\u043c\u043a\u0430.',
          image: '\u041a\u0430\u0447\u0438 \u0441\u043d\u0438\u043c\u043a\u0430, \u0430\u043a\u043e \u043d\u0435 \u0438\u0441\u043a\u0430\u0448 \u0434\u0430 \u0438\u0437\u043f\u0440\u0430\u0449\u0430\u0448 \u0442\u0435\u043a\u0441\u0442.',
        },
      });
    }

    const ipHash = createHash('sha256').update(getTrustedClientIp(req)).digest('hex');
    const tipId = await nextNumericId(Tip);

    const newTip = new Tip({
      id: tipId,
      text,
      location: normalizeText(req.body.location || '', 300),
      image: imageUrl,
      imageMeta,
      ipHash,
    });
    await newTip.save();

    return res.json({ ok: true, id: newTip.id });
  });

  app.patch('/api/tips/:id', requireAuth, requireAnyPermission(TIP_ADMIN_PERMISSIONS), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const data = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'status')) {
      const { status } = req.body;
      if (!['new', 'processed', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      data.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'assignedEditor')) {
      data.assignedEditor = normalizeAssignedEditor(normalizeText, req.body.assignedEditor);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'priority')) {
      const normalizedPriority = normalizeText(req.body.priority || '', 20).toLowerCase();
      if (!TIP_PRIORITY_VALUES.has(normalizedPriority)) {
        return res.status(400).json({ error: 'Invalid priority' });
      }
      data.priority = normalizedPriority;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'tags')) {
      data.tags = normalizeTags(normalizeText, req.body.tags);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'dueAt')) {
      const normalizedDueAt = normalizeDueAt(req.body.dueAt);
      if (typeof normalizedDueAt === 'undefined') {
        return res.status(400).json({ error: 'Invalid due date' });
      }
      data.dueAt = normalizedDueAt;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    data.lastActionAt = new Date();
    data.lastActionBy = getActorName(req, normalizeText);

    const tip = await Tip.findOneAndUpdate(
      { id },
      data,
      { returnDocument: 'after' }
    );
    if (!tip) return res.status(404).json({ error: 'Not found' });

    AuditLog?.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'tips',
      resourceId: id,
      details: buildTipAuditDetails(data),
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

    res.json(tip);
  });

  app.delete('/api/tips/:id', requireAuth, requireAnyPermission(TIP_ADMIN_PERMISSIONS), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const tip = await Tip.findOneAndDelete({ id });
    if (!tip) return res.status(404).json({ error: 'Not found' });

    AuditLog?.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'delete',
      resource: 'tips',
      resourceId: id,
      details: '',
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

    res.json({ ok: true });
  });
}
