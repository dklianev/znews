import express from 'express';
import { asyncHandler } from '../services/expressAsyncService.js';

export function createAdsRouter(deps) {
  const {
    Ad,
    AuditLog,
    buildAdAnalyticsSummary,
    buildAdCandidate,
    cacheMiddleware,
    invalidateCacheGroup,
    listAdsForRequest,
    nextNumericId,
    normalizeAdRecord,
    recordAdAnalyticsEvent,
    requireAuth,
    requirePermission,
    resolveTrackedAdCandidate,
    sanitizeAdAnalyticsContext,
    sanitizeAdPayload,
    stripDocumentMetadata,
    validateAdCandidate,
  } = deps;

  const adsRouter = express.Router();

  adsRouter.get('/analytics/summary', requireAuth, requirePermission('ads'), asyncHandler(async (req, res) => {
    const summary = await buildAdAnalyticsSummary({ days: req.query.days });
    res.json(summary);
  }));

  adsRouter.post('/:id/impression', asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const context = sanitizeAdAnalyticsContext(req.body);
    if (context.error) return res.status(400).json({ error: context.error });

    const resolvedAd = await resolveTrackedAdCandidate(id, context);
    if (!resolvedAd) return res.status(404).json({ error: 'Ad is not active for this slot' });

    const result = await recordAdAnalyticsEvent({ req, adId: id, eventType: 'impression', context });
    res.status(result.deduped ? 200 : 201).json({ ok: true, deduped: result.deduped });
  }));

  adsRouter.post('/:id/click', asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const context = sanitizeAdAnalyticsContext(req.body);
    if (context.error) return res.status(400).json({ error: context.error });

    const resolvedAd = await resolveTrackedAdCandidate(id, context);
    if (!resolvedAd) return res.status(404).json({ error: 'Ad is not active for this slot' });

    await recordAdAnalyticsEvent({ req, adId: id, eventType: 'click', context });
    res.status(201).json({ ok: true });
  }));

  adsRouter.get('/', cacheMiddleware, asyncHandler(async (req, res) => {
    const items = await listAdsForRequest(req);
    res.json(items);
  }));

  adsRouter.post('/', requireAuth, requirePermission('ads'), asyncHandler(async (req, res) => {
    const patch = sanitizeAdPayload(req.body, { partial: false });
    const candidate = buildAdCandidate(null, patch);
    const errors = validateAdCandidate(candidate);
    if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });

    const id = await nextNumericId(Ad);
    const item = await Ad.create({ ...candidate, id });
    const obj = normalizeAdRecord(stripDocumentMetadata(item.toJSON()));

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'create',
      resource: 'ads',
      resourceId: id,
      details: obj.campaignName || obj.title || '',
    }).catch(() => {});

    invalidateCacheGroup('ads', 'ads-mutation');

    res.status(201).json(obj);
  }));

  adsRouter.put('/:id', requireAuth, requirePermission('ads'), asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const patch = sanitizeAdPayload(req.body, { partial: true });
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const existing = await Ad.findOne({ id }).lean();
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const candidate = buildAdCandidate(existing, patch);
    const errors = validateAdCandidate(candidate);
    if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });

    const { id: _ignoredId, ...updateDoc } = candidate;
    const item = await Ad.findOneAndUpdate({ id }, { $set: updateDoc }, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'Not found' });

    const obj = normalizeAdRecord(stripDocumentMetadata(item.toJSON()));
    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'ads',
      resourceId: id,
      details: obj.campaignName || obj.title || '',
    }).catch(() => {});

    invalidateCacheGroup('ads', 'ads-mutation');

    res.json(obj);
  }));

  adsRouter.delete('/:id', requireAuth, requirePermission('ads'), asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = await Ad.deleteOne({ id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'delete',
      resource: 'ads',
      resourceId: id,
      details: '',
    }).catch(() => {});

    invalidateCacheGroup('ads', 'ads-mutation');

    res.json({ ok: true });
  }));

  return adsRouter;
}
