export function createDbBootstrapService({
  BREAKING_CATEGORY_LABEL,
  Category,
  DEFAULT_PERMISSION_DOCS,
  Permission,
  PERMISSION_KEYS,
  SiteSettings,
  devMongoFallbackUri = 'mongodb://127.0.0.1:27017/zemun-news',
  isProd,
  loadMongoMemoryServer = async () => {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    return MongoMemoryServer;
  },
  loadSeedAll = async () => {
    const { seedAll } = await import('../seed.js');
    return seedAll;
  },
  logInfo = (...args) => console.log(...args),
  logWarning = (...args) => console.warn(...args),
  modelsWithIndexes = [],
  mongoUri,
  mongoose,
  normalizeText,
}) {
  const LEGACY_BROKEN_BREAKING_LABEL = '??????';

  function sanitizePermissionMap(value) {
    const src = value && typeof value === 'object' ? value : {};
    return PERMISSION_KEYS.reduce((acc, key) => {
      acc[key] = Boolean(src[key]);
      return acc;
    }, {});
  }

  function logBootstrapWarning(message, error) {
    logWarning(message, error?.message || error);
  }

  function normalizeBreakingLinks(links) {
    if (!Array.isArray(links)) return { next: null, changed: false };

    let changed = false;
    const next = links.map((item) => {
      if (!item || item.to !== '/category/breaking') return item;

      const normalizedLabel = normalizeText(item.label, 50);
      if (normalizedLabel && normalizedLabel.toLowerCase() !== LEGACY_BROKEN_BREAKING_LABEL) {
        return item;
      }

      changed = true;
      return { ...item, label: BREAKING_CATEGORY_LABEL };
    });

    return { next, changed };
  }

  function isPlaceholderMongoUri(uri) {
    return !uri || /YOUR_PASSWORD|xxxxx|user:password/i.test(uri);
  }

  async function resetConnectionForFallback() {
    const readyState = Number(mongoose?.connection?.readyState || 0);
    if (readyState === 0) return;

    try {
      if (typeof mongoose.disconnect === 'function') {
        await mongoose.disconnect();
        return;
      }
      if (typeof mongoose?.connection?.close === 'function') {
        await mongoose.connection.close();
      }
    } catch (error) {
      logBootstrapWarning('? Failed to reset previous Mongo connection before fallback:', error);
    }
  }

  async function connectInMemoryMongo() {
    const MongoMemoryServer = await loadMongoMemoryServer();
    const mongod = await MongoMemoryServer.create();
    try {
      const memUri = mongod.getUri();
      await mongoose.connect(memUri);
      logInfo('- MongoDB in-memory (dev mode)');

      const seedAll = await loadSeedAll();
      await seedAll({ allowDestructive: true, reason: 'dev-inmemory-bootstrap' });
      logInfo('- Database seeded with defaults');
    } catch (error) {
      await resetConnectionForFallback();
      await mongod.stop().catch(() => {});
      throw error;
    }
  }

  async function connectLocalMongoFallback(memoryError) {
    logWarning(`? In-memory MongoDB failed: ${memoryError.message}`);
    logWarning(`? Trying local MongoDB fallback: ${devMongoFallbackUri}`);

    try {
      await resetConnectionForFallback();
      await mongoose.connect(devMongoFallbackUri, { serverSelectionTimeoutMS: 3000 });
      logInfo('- MongoDB local fallback connected');
    } catch (fallbackError) {
      throw new Error(
        `Mongo init failed. In-memory: ${memoryError.message}. Local fallback: ${fallbackError.message}. ` +
        'Set a valid MONGODB_URI in .env.'
      );
    }
  }

  async function ensureDefaultPermissionDocs() {
    try {
      await Promise.all(
        Object.entries(DEFAULT_PERMISSION_DOCS).map(async ([role, permissionMap]) => {
          const permissions = sanitizePermissionMap(permissionMap);
          const existing = await Permission.findOne({ role }).lean();

          if (!existing) {
            await Permission.create({ role, permissions });
            return;
          }

          const missingPermissionPatch = {};
          PERMISSION_KEYS.forEach((key) => {
            if (typeof existing.permissions?.[key] === 'boolean') return;
            missingPermissionPatch[`permissions.${key}`] = Boolean(permissions[key]);
          });

          if (Object.keys(missingPermissionPatch).length > 0) {
            await Permission.updateOne({ role }, { $set: missingPermissionPatch });
          }
        })
      );
    } catch (error) {
      logBootstrapWarning('? Failed to ensure default permissions:', error);
    }
  }

  async function migrateBreakingCategoryLabels() {
    try {
      await Category.updateOne(
        {
          id: 'breaking',
          $or: [
            { name: { $exists: false } },
            { name: null },
            { name: '' },
            { name: /^\s*\?{6}\s*$/i },
          ],
        },
        { $set: { name: BREAKING_CATEGORY_LABEL } }
      );
    } catch (error) {
      logBootstrapWarning('? Failed to migrate breaking category label:', error);
    }

    try {
      const doc = await SiteSettings.findOne({ key: 'main' }).lean();
      if (!doc) return;

      const navbarLinks = normalizeBreakingLinks(doc.navbarLinks);
      const footerQuickLinks = normalizeBreakingLinks(doc.footerQuickLinks);

      const updates = {};
      if (navbarLinks.changed) updates.navbarLinks = navbarLinks.next;
      if (footerQuickLinks.changed) updates.footerQuickLinks = footerQuickLinks.next;
      if (Object.keys(updates).length === 0) return;

      await SiteSettings.updateOne({ key: 'main' }, { $set: updates });
    } catch (error) {
      logBootstrapWarning('? Failed to migrate breaking labels in site settings:', error);
    }
  }

  async function connectDB() {
    const uri = mongoUri;

    if (isPlaceholderMongoUri(uri)) {
      if (isProd) {
        throw new Error('MONGODB_URI must be configured for production.');
      }

      try {
        await connectInMemoryMongo();
        return;
      } catch (memoryError) {
        await connectLocalMongoFallback(memoryError);
        return;
      }
    }

    await mongoose.connect(uri);
    logInfo('– MongoDB connected');
  }

  async function ensureDbIndexes() {
    try {
      await Promise.all(modelsWithIndexes.map((Model) => Model.init()));
      logInfo('– MongoDB indexes ensured');
    } catch (error) {
      logBootstrapWarning('? MongoDB index init failed:', error);
    }
  }

  return {
    connectDB,
    ensureDbIndexes,
    ensureDefaultPermissionDocs,
    migrateBreakingCategoryLabels,
    sanitizePermissionMap,
  };
}
