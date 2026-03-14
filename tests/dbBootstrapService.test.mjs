import assert from 'node:assert/strict';
import { createDbBootstrapService } from '../server/services/dbBootstrapService.js';

const LEGACY_BROKEN_BREAKING_LABEL = '\u003f\u003f\u003f\u003f\u003f\u003f';

function createPermissionModel(existingDocs = {}) {
  const created = [];
  const updated = [];
  return {
    created,
    updated,
    async create(doc) {
      created.push(doc);
    },
    findOne(query) {
      return {
        async lean() {
          return existingDocs[query.role] || null;
        },
      };
    },
    async updateOne(query, patch) {
      updated.push({ query, patch });
    },
  };
}

function createHelpers(overrides = {}) {
  const logs = [];
  const warnings = [];
  const mongoose = {
    connectCalls: [],
    async connect(...args) {
      this.connectCalls.push(args);
    },
  };
  const permissionModel = createPermissionModel(overrides.existingPermissionDocs);
  const siteSettingsUpdates = [];
  const categoryUpdates = [];
  const seedCalls = [];

  const helpers = createDbBootstrapService({
    BREAKING_CATEGORY_LABEL: 'Извънредни',
    Category: {
      async updateOne(query, update) {
        categoryUpdates.push({ query, update });
      },
    },
    DEFAULT_PERMISSION_DOCS: {
      admin: { articles: true, categories: true },
      editor: { articles: true, categories: false },
    },
    Permission: permissionModel,
    PERMISSION_KEYS: ['articles', 'categories'],
    SiteSettings: {
      findOne() {
        return {
          async lean() {
            return overrides.siteSettingsDoc ?? null;
          },
        };
      },
      async updateOne(query, update) {
        siteSettingsUpdates.push({ query, update });
      },
    },
    devMongoFallbackUri: 'mongodb://127.0.0.1:27017/zemun-news',
    isProd: false,
    loadMongoMemoryServer: async () => ({
      create: async () => ({
        getUri: () => 'mongodb://memory/zemun-news',
      }),
    }),
    loadSeedAll: async () => async (payload) => {
      seedCalls.push(payload);
    },
    logInfo: (...args) => logs.push(args.join(' ')),
    logWarning: (...args) => warnings.push(args.join(' ')),
    modelsWithIndexes: overrides.modelsWithIndexes || [
      { initCalls: 0, async init() { this.initCalls += 1; } },
      { initCalls: 0, async init() { this.initCalls += 1; } },
    ],
    mongoUri: overrides.mongoUri,
    mongoose,
    normalizeText(value, maxLen = 255) {
      return String(value ?? '').trim().slice(0, maxLen);
    },
    ...overrides,
  });

  return { categoryUpdates, helpers, logs, mongoose, permissionModel, seedCalls, siteSettingsUpdates, warnings };
}

export async function runDbBootstrapServiceTests() {
  {
    const { helpers } = createHelpers();
    assert.deepEqual(helpers.sanitizePermissionMap({ articles: 1, categories: 0, ignored: true }), {
      articles: true,
      categories: false,
    });
  }

  {
    const { helpers, permissionModel, warnings } = createHelpers({
      existingPermissionDocs: {
        admin: { role: 'admin', permissions: { articles: true } },
      },
    });
    await helpers.ensureDefaultPermissionDocs();
    assert.deepEqual(permissionModel.created, [
      { role: 'editor', permissions: { articles: true, categories: false } },
    ]);
    assert.deepEqual(permissionModel.updated, [
      {
        query: { role: 'admin' },
        patch: { $set: { 'permissions.categories': true } },
      },
    ]);
    assert.equal(warnings.length, 0);
  }

  {
    const { helpers, categoryUpdates, siteSettingsUpdates } = createHelpers({
      siteSettingsDoc: {
        key: 'main',
        navbarLinks: [
          { to: '/category/breaking', label: LEGACY_BROKEN_BREAKING_LABEL },
          { to: '/category/crime', label: 'Криминални' },
        ],
        footerQuickLinks: [
          { to: '/category/breaking', label: '' },
        ],
      },
    });
    await helpers.migrateBreakingCategoryLabels();
    assert.equal(categoryUpdates.length, 1);
    assert.deepEqual(categoryUpdates[0].update, { $set: { name: 'Извънредни' } });
    assert.equal(siteSettingsUpdates.length, 1);
    assert.deepEqual(siteSettingsUpdates[0], {
      query: { key: 'main' },
      update: {
        $set: {
          navbarLinks: [
            { to: '/category/breaking', label: 'Извънредни' },
            { to: '/category/crime', label: 'Криминални' },
          ],
          footerQuickLinks: [
            { to: '/category/breaking', label: 'Извънредни' },
          ],
        },
      },
    });
  }

  {
    const models = [
      { count: 0, async init() { this.count += 1; } },
      { count: 0, async init() { this.count += 1; } },
    ];
    const { helpers, logs, warnings } = createHelpers({ modelsWithIndexes: models });
    await helpers.ensureDbIndexes();
    assert.equal(models[0].count, 1);
    assert.equal(models[1].count, 1);
    assert.equal(logs.some((line) => line.includes('MongoDB indexes ensured')), true);
    assert.equal(warnings.length, 0);
  }

  {
    const { helpers, logs, mongoose, seedCalls } = createHelpers({ mongoUri: 'mongodb://mongo/prod' });
    await helpers.connectDB();
    assert.deepEqual(mongoose.connectCalls, [['mongodb://mongo/prod']]);
    assert.equal(logs.some((line) => line.includes('MongoDB connected')), true);
    assert.equal(seedCalls.length, 0);
  }

  {
    const { helpers, logs, mongoose, seedCalls } = createHelpers({ mongoUri: '' });
    await helpers.connectDB();
    assert.deepEqual(mongoose.connectCalls, [['mongodb://memory/zemun-news']]);
    assert.deepEqual(seedCalls, [{ allowDestructive: true, reason: 'dev-inmemory-bootstrap' }]);
    assert.equal(logs.some((line) => line.includes('MongoDB in-memory')), true);
    assert.equal(logs.some((line) => line.includes('Database seeded with defaults')), true);
  }

  {
    const mongoose = {
      connectCalls: [],
      connection: { readyState: 0 },
      async connect(...args) {
        this.connectCalls.push(args);
        this.connection.readyState = 1;
      },
    };
    const warnings = [];
    const helpers = createDbBootstrapService({
      BREAKING_CATEGORY_LABEL: 'Извънредни',
      Category: { async updateOne() {} },
      DEFAULT_PERMISSION_DOCS: {},
      Permission: createPermissionModel(),
      PERMISSION_KEYS: [],
      SiteSettings: { findOne: () => ({ lean: async () => null }), async updateOne() {} },
      devMongoFallbackUri: 'mongodb://127.0.0.1:27017/zemun-news',
      isProd: false,
      loadMongoMemoryServer: async () => { throw new Error('memory failed'); },
      logInfo: () => {},
      logWarning: (...args) => warnings.push(args.join(' ')),
      modelsWithIndexes: [],
      mongoUri: '',
      mongoose,
      normalizeText: (value) => String(value ?? '').trim(),
    });
    await helpers.connectDB();
    assert.deepEqual(mongoose.connectCalls, [[
      'mongodb://127.0.0.1:27017/zemun-news',
      { serverSelectionTimeoutMS: 3000 },
    ]]);
    assert.equal(warnings.some((line) => line.includes('In-memory MongoDB failed: memory failed')), true);
    assert.equal(warnings.some((line) => line.includes('Trying local MongoDB fallback')), true);
  }

  {
    const mongoose = {
      connectCalls: [],
      disconnectCalls: 0,
      connection: { readyState: 0 },
      async connect(...args) {
        this.connectCalls.push(args);
        this.connection.readyState = 1;
      },
      async disconnect() {
        this.disconnectCalls += 1;
        this.connection.readyState = 0;
      },
    };
    const warnings = [];
    const helpers = createDbBootstrapService({
      BREAKING_CATEGORY_LABEL: '??????????',
      Category: { async updateOne() {} },
      DEFAULT_PERMISSION_DOCS: {},
      Permission: createPermissionModel(),
      PERMISSION_KEYS: [],
      SiteSettings: { findOne: () => ({ lean: async () => null }), async updateOne() {} },
      devMongoFallbackUri: 'mongodb://127.0.0.1:27017/zemun-news',
      isProd: false,
      loadMongoMemoryServer: async () => ({
        create: async () => ({
          getUri: () => 'mongodb://memory/zemun-news',
          stop: async () => {},
        }),
      }),
      loadSeedAll: async () => {
        throw new Error('seed import failed');
      },
      logInfo: () => {},
      logWarning: (...args) => warnings.push(args.join(' ')),
      modelsWithIndexes: [],
      mongoUri: '',
      mongoose,
      normalizeText: (value) => String(value ?? '').trim(),
    });

    await helpers.connectDB();
    assert.deepEqual(mongoose.connectCalls, [
      ['mongodb://memory/zemun-news'],
      ['mongodb://127.0.0.1:27017/zemun-news', { serverSelectionTimeoutMS: 3000 }],
    ]);
    assert.equal(mongoose.disconnectCalls, 1);
    assert.equal(warnings.some((line) => line.includes('In-memory MongoDB failed: seed import failed')), true);
  }

  {
    const { helpers } = createHelpers({ isProd: true, mongoUri: '' });
    await assert.rejects(
      () => helpers.connectDB(),
      /MONGODB_URI must be configured for production/
    );
  }
}
