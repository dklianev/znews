import express from 'express';
import { asyncHandler } from '../services/expressAsyncService.js';

export function createUsersRouter(deps) {
  const {
    AuditLog,
    AuthSession,
    bcrypt,
    hasOwn,
    isKnownRole,
    nextNumericId,
    normalizeText,
    requireAdmin,
    requireAuth,
    requirePermission,
    sanitizeDate,
    User,
  } = deps;

  const usersRouter = express.Router();

  usersRouter.get('/', requireAuth, requirePermission('profiles'), asyncHandler(async (_req, res) => {
    const items = await User.find().sort({ id: -1 }).lean();
    items.forEach((item) => {
      delete item._id;
      delete item.__v;
      delete item.password;
    });
    res.json(items);
  }));

  usersRouter.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const username = normalizeText(req.body.username, 40).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!username || password.length < 8) {
      return res.status(400).json({ error: 'Username and password (min 8 chars) are required' });
    }
    const existing = await User.findOne({ username }).lean();
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    const role = normalizeText(req.body.role, 32) || 'reporter';
    if (!(await isKnownRole(role))) {
      return res.status(400).json({ error: 'Unknown role' });
    }

    const id = await nextNumericId(User);
    const item = await User.create({
      id,
      username,
      password: await bcrypt.hash(password, 10),
      name: normalizeText(req.body.name, 80),
      role,
      profession: normalizeText(req.body.profession, 120),
      avatar: normalizeText(req.body.avatar, 16) || '??',
      createdAt: sanitizeDate(req.body.createdAt),
    });

    const obj = item.toJSON();
    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'create',
      resource: 'users',
      resourceId: id,
      details: obj.name || '',
    }).catch(() => {});
    res.json(obj);
  }));

  usersRouter.put('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    let passwordChanged = false;
    const data = {};

    if (hasOwn(req.body, 'name')) data.name = normalizeText(req.body.name, 80);
    if (hasOwn(req.body, 'profession')) data.profession = normalizeText(req.body.profession, 120);
    if (hasOwn(req.body, 'avatar')) data.avatar = normalizeText(req.body.avatar, 16) || '??';

    if (hasOwn(req.body, 'username')) {
      const username = normalizeText(req.body.username, 40).toLowerCase();
      if (!username) return res.status(400).json({ error: 'Invalid username' });
      const existing = await User.findOne({ username, id: { $ne: id } }).lean();
      if (existing) return res.status(409).json({ error: 'Username already exists' });
      data.username = username;
    }

    if (hasOwn(req.body, 'role')) {
      const role = normalizeText(req.body.role, 32);
      if (!role) return res.status(400).json({ error: 'Invalid role' });
      if (!(await isKnownRole(role))) return res.status(400).json({ error: 'Unknown role' });
      if (id === 1 && role !== 'admin') {
        return res.status(403).json({ error: 'Cannot downgrade main admin account' });
      }
      data.role = role;
    }

    if (hasOwn(req.body, 'password')) {
      const password = typeof req.body.password === 'string' ? req.body.password : '';
      if (password.length > 0 && password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      if (password.length >= 8) {
        data.password = await bcrypt.hash(password, 10);
        passwordChanged = true;
      }
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const item = await User.findOneAndUpdate({ id }, { $set: data }, { new: true });
    if (!item) return res.status(404).json({ error: 'Not found' });

    if (passwordChanged) {
      await AuthSession.deleteMany({ userId: id });
    }

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'users',
      resourceId: id,
      details: data.name || '',
    }).catch(() => {});

    res.json(item.toJSON());
  }));

  usersRouter.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    if (id === 1) return res.status(403).json({ error: 'Cannot delete main admin' });

    const result = await User.deleteOne({ id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'delete',
      resource: 'users',
      resourceId: id,
      details: '',
    }).catch(() => {});

    res.json({ ok: true });
  }));

  return usersRouter;
}
