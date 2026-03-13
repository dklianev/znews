import express from 'express';
import { asyncHandler } from '../../services/expressAsyncService.js';

export function createNumericCrudFactory({
  AuditLog,
  cacheMiddleware,
  invalidateCacheTags,
  nextNumericId,
  parseCollectionPagination,
  requireAdmin,
  requireAuth,
  requirePermission,
}) {
  return function numericCrud(Model, resourceName = 'unknown', defaultSort = { id: -1 }, sensitiveFields = [], writePermission = null) {
    const router = express.Router();
    const writeGuards = writePermission
      ? [requireAuth, requirePermission(writePermission)]
      : [requireAuth, requireAdmin];

    const sanitizeWritePayload = (payload) => {
      const next = { ...(payload || {}) };
      delete next.id;
      delete next._id;
      delete next.__v;
      return next;
    };

    router.get('/', cacheMiddleware, asyncHandler(async (req, res) => {
      const pagination = parseCollectionPagination(req.query, { defaultLimit: 50, maxLimit: 250 });
      let query = Model.find().sort(defaultSort);
      if (pagination.shouldPaginate) {
        query = query.skip(pagination.skip).limit(pagination.limit);
      }
      const items = await query.lean();
      items.forEach((item) => {
        delete item._id;
        delete item.__v;
        sensitiveFields.forEach((field) => delete item[field]);
      });
      if (!pagination.shouldPaginate) {
        return res.json(items);
      }
      const total = await Model.countDocuments({});
      return res.json({
        items,
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      });
    }));

    router.post('/', ...writeGuards, asyncHandler(async (req, res) => {
      const id = await nextNumericId(Model);
      const data = sanitizeWritePayload(req.body);
      const item = await Model.create({ ...data, id });
      const obj = item.toJSON();
      AuditLog.create({
        user: req.user.name,
        userId: req.user.userId,
        action: 'create',
        resource: resourceName,
        resourceId: id,
        details: obj.title || obj.name || obj.question || '',
      }).catch(() => {});

      invalidateCacheTags([resourceName, 'bootstrap', 'homepage'], { reason: `${resourceName}-mutation` });

      return res.status(201).json(obj);
    }));

    router.put('/:id', ...writeGuards, asyncHandler(async (req, res) => {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
      const data = sanitizeWritePayload(req.body);
      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      const item = await Model.findOneAndUpdate({ id }, { $set: data }, { new: true, runValidators: true });
      if (!item) return res.status(404).json({ error: 'Not found' });
      AuditLog.create({
        user: req.user.name,
        userId: req.user.userId,
        action: 'update',
        resource: resourceName,
        resourceId: id,
        details: data.title || data.name || '',
      }).catch(() => {});

      invalidateCacheTags([resourceName, 'bootstrap', 'homepage'], { reason: `${resourceName}-mutation` });

      return res.json(item.toJSON());
    }));

    router.delete('/:id', ...writeGuards, asyncHandler(async (req, res) => {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
      const result = await Model.deleteOne({ id });
      if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
      AuditLog.create({
        user: req.user.name,
        userId: req.user.userId,
        action: 'delete',
        resource: resourceName,
        resourceId: id,
        details: '',
      }).catch(() => {});

      invalidateCacheTags([resourceName, 'bootstrap', 'homepage'], { reason: `${resourceName}-mutation` });

      return res.json({ ok: true });
    }));

    return router;
  };
}
