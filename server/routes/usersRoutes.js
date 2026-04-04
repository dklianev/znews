import express from 'express';

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

  usersRouter.get('/', requireAuth, requirePermission('profiles'), async (_req, res) => {
    const items = await User.find().select('-password -_id -__v').sort({ id: -1 }).lean();
    res.json(items);
  });

  usersRouter.post('/', requireAuth, requireAdmin, async (req, res) => {
    const fieldErrors = {};
    const name = normalizeText(req.body.name, 80);
    const username = normalizeText(req.body.username, 40).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role = normalizeText(req.body.role, 32) || 'reporter';

    if (!name) fieldErrors.name = 'Името е задължително.';
    if (!username) fieldErrors.username = 'Потребителското име е задължително.';
    if (password.length < 8) fieldErrors.password = 'Паролата трябва да е поне 8 символа.';
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({
        error: 'Поправи маркираните полета.',
        fieldErrors,
      });
    }

    const existing = await User.findOne({ username }).lean();
    if (existing) {
      return res.status(409).json({
        error: 'Потребителското име вече съществува.',
        fieldErrors: { username: 'Потребителското име вече съществува.' },
      });
    }

    if (!(await isKnownRole(role))) {
      return res.status(400).json({
        error: 'Невалидна роля.',
        fieldErrors: { role: 'Избери съществуваща роля.' },
      });
    }

    const id = await nextNumericId(User);
    const item = await User.create({
      id,
      username,
      password: await bcrypt.hash(password, 10),
      name,
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
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));
    res.json(obj);
  });

  usersRouter.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    let passwordChanged = false;
    const data = {};
    const fieldErrors = {};

    if (hasOwn(req.body, 'name')) {
      const normalizedName = normalizeText(req.body.name, 80);
      if (!normalizedName) fieldErrors.name = 'Името е задължително.';
      else data.name = normalizedName;
    }
    if (hasOwn(req.body, 'profession')) data.profession = normalizeText(req.body.profession, 120);
    if (hasOwn(req.body, 'avatar')) data.avatar = normalizeText(req.body.avatar, 16) || '??';

    if (hasOwn(req.body, 'username')) {
      const username = normalizeText(req.body.username, 40).toLowerCase();
      if (!username) {
        fieldErrors.username = 'Потребителското име е задължително.';
      } else {
        const existing = await User.findOne({ username, id: { $ne: id } }).lean();
        if (existing) {
          fieldErrors.username = 'Потребителското име вече съществува.';
        } else {
          data.username = username;
        }
      }
    }

    if (hasOwn(req.body, 'role')) {
      const role = normalizeText(req.body.role, 32);
      if (!role) {
        fieldErrors.role = 'Ролята е задължителна.';
      } else if (!(await isKnownRole(role))) {
        fieldErrors.role = 'Избери съществуваща роля.';
      } else if (id === 1 && role !== 'admin') {
        return res.status(403).json({
          error: 'Не можеш да свалиш главния администратор.',
          fieldErrors: { role: 'Главният администратор трябва да остане с роля admin.' },
        });
      } else {
        data.role = role;
      }
    }

    if (hasOwn(req.body, 'password')) {
      const password = typeof req.body.password === 'string' ? req.body.password : '';
      if (password.length > 0 && password.length < 8) {
        fieldErrors.password = 'Паролата трябва да е поне 8 символа.';
      }
      if (password.length >= 8) {
        data.password = await bcrypt.hash(password, 10);
        passwordChanged = true;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      const statusCode = fieldErrors.username === 'Потребителското име вече съществува.' ? 409 : 400;
      return res.status(statusCode).json({
        error: 'Поправи маркираните полета.',
        fieldErrors,
      });
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const item = await User.findOneAndUpdate({ id }, { $set: data }, { returnDocument: 'after', runValidators: true });
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
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

    res.json(item.toJSON());
  });

  usersRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
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
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

    res.json({ ok: true });
  });

  return usersRouter;
}
