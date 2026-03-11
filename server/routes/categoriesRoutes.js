import express from 'express';

export function createCategoriesRouter(deps) {
  const {
    Article,
    Category,
    hasOwn,
    invalidateCacheGroup,
    normalizeText,
    publicError,
    requireAuth,
    requirePermission,
  } = deps;

  const catRouter = express.Router();

  catRouter.get('/', async (_req, res) => {
    try {
      const items = await Category.find().lean();
      items.forEach((item) => {
        delete item._id;
        delete item.__v;
      });
      res.json(items);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  catRouter.post('/', requireAuth, requirePermission('categories'), async (req, res) => {
    try {
      const id = normalizeText(req.body.id, 64);
      const name = normalizeText(req.body.name, 80);
      const icon = normalizeText(req.body.icon, 16);
      if (!id || !name) return res.status(400).json({ error: 'Invalid category payload' });
      const item = await Category.create({ id, name, icon });

      invalidateCacheGroup('categories', 'categories-mutation');

      res.json(item.toJSON());
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  catRouter.put('/:id', requireAuth, requirePermission('categories'), async (req, res) => {
    try {
      const updates = {};
      if (hasOwn(req.body, 'name')) updates.name = normalizeText(req.body.name, 80);
      if (hasOwn(req.body, 'icon')) updates.icon = normalizeText(req.body.icon, 16);
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

      const item = await Category.findOneAndUpdate(
        { id: req.params.id },
        { $set: updates },
        { new: true }
      );
      if (!item) return res.status(404).json({ error: 'Not found' });

      invalidateCacheGroup('categories', 'categories-mutation');

      res.json(item.toJSON());
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  catRouter.delete('/:id', requireAuth, requirePermission('categories'), async (req, res) => {
    try {
      if (req.params.id === 'all') return res.json({ ok: false });
      const categoryId = normalizeText(req.params.id, 64);
      if (!categoryId) return res.status(400).json({ error: 'Invalid category id' });

      const usedCount = await Article.countDocuments({ category: categoryId });
      if (usedCount > 0) {
        return res.status(409).json({ error: `Category is used by ${usedCount} article(s)` });
      }

      const result = await Category.deleteOne({ id: categoryId });
      if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });

      invalidateCacheGroup('categories', 'categories-mutation');

      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  return catRouter;
}
