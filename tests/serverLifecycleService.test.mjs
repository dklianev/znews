import assert from 'node:assert/strict';
import { createServerLifecycleService } from '../server/services/serverLifecycleService.js';

function createFakeProcess() {
  const handlers = new Map();
  return {
    exits: [],
    handlers,
    once(event, handler) {
      handlers.set(event, handler);
    },
    exit(code) {
      this.exits.push(code);
    },
  };
}

function createFakeServer() {
  const handlers = new Map();
  return {
    closeAllConnectionsCalls: 0,
    closeCalls: 0,
    closeIdleConnectionsCalls: 0,
    handlers,
    on(event, handler) {
      handlers.set(event, handler);
    },
    close(callback) {
      this.closeCalls += 1;
      callback?.();
    },
    closeIdleConnections() {
      this.closeIdleConnectionsCalls += 1;
    },
    closeAllConnections() {
      this.closeAllConnectionsCalls += 1;
    },
  };
}

function createTimerHarness() {
  const scheduled = [];
  const cleared = [];
  function setTimeoutImpl(fn, ms) {
    const handle = {
      cleared: false,
      fn,
      ms,
      unrefCalled: false,
      unref() {
        this.unrefCalled = true;
      },
    };
    scheduled.push(handle);
    return handle;
  }
  function clearTimeoutImpl(handle) {
    if (handle) {
      handle.cleared = true;
      cleared.push(handle);
    }
  }
  return { clearTimeoutImpl, cleared, scheduled, setTimeoutImpl };
}

function createHelpers(overrides = {}) {
  const logs = [];
  const errors = [];
  const warnings = [];
  const processObject = overrides.processObject || createFakeProcess();
  const server = overrides.server || createFakeServer();
  const callOrder = [];
  const mongooseErrorHandlers = [];
  let shuttingDown = false;
  let backfillPayload = null;
  let backgroundJobsStarted = 0;
  let backgroundJobsStopped = 0;
  let reportServerErrorPayload = null;
  let mongooseCloseArg = null;

  const mongoose = overrides.mongoose || {
    connection: {
      closeCalls: [],
      async close(force) {
        mongooseCloseArg = force;
        this.closeCalls.push(force);
      },
      on(event, handler) {
        mongooseErrorHandlers.push({ event, handler });
      },
    },
  };

  const app = overrides.app || {
    listenCalls: [],
    listen(port, callback) {
      this.listenCalls.push(port);
      callback?.();
      return server;
    },
  };

  const service = createServerLifecycleService({
    app,
    backfillImagePipeline: overrides.backfillImagePipeline || (async (payload) => {
      backfillPayload = payload;
      return {
        engine: 'sharp',
        failed: 0,
        generated: 2,
        skipped: 1,
        syncedArticleMeta: 2,
        syncedTipMeta: 1,
      };
    }),
    connectDB: overrides.connectDB || (async () => { callOrder.push('connectDB'); }),
    ensureDbIndexes: overrides.ensureDbIndexes || (async () => { callOrder.push('ensureDbIndexes'); }),
    ensureDefaultPermissionDocs: overrides.ensureDefaultPermissionDocs || (async () => { callOrder.push('ensureDefaultPermissionDocs'); }),
    ensureGameDefinitions: overrides.ensureGameDefinitions || (async () => { callOrder.push('ensureGameDefinitions'); }),
    getShuttingDown: () => shuttingDown,
    isProd: overrides.isProd ?? false,
    logError: (...args) => errors.push(args.join(' ')),
    logInfo: (...args) => logs.push(args.join(' ')),
    logWarning: (...args) => warnings.push(args.join(' ')),
    migrateBreakingCategoryLabels: overrides.migrateBreakingCategoryLabels || (async () => { callOrder.push('migrateBreakingCategoryLabels'); }),
    mongoose,
    port: overrides.port || 3001,
    processEnv: overrides.processEnv || {},
    processObject,
    reportServerError: overrides.reportServerError || (async (...args) => { reportServerErrorPayload = args; }),
    setShuttingDown(value) {
      shuttingDown = Boolean(value);
    },
    setTimeoutImpl: overrides.setTimeoutImpl,
    clearTimeoutImpl: overrides.clearTimeoutImpl,
    startBackgroundJobs: overrides.startBackgroundJobs || (() => { backgroundJobsStarted += 1; }),
    stopBackgroundJobs: overrides.stopBackgroundJobs || (() => { backgroundJobsStopped += 1; }),
  });

  return {
    app,
    backgroundJobsStarted: () => backgroundJobsStarted,
    backgroundJobsStopped: () => backgroundJobsStopped,
    backfillPayload: () => backfillPayload,
    callOrder,
    errors,
    logs,
    mongoose,
    mongooseCloseArg: () => mongooseCloseArg,
    mongooseErrorHandlers,
    processObject,
    reportServerErrorPayload: () => reportServerErrorPayload,
    server,
    service,
    warnings,
  };
}

export async function runServerLifecycleServiceTests() {
  {
    const helpers = createHelpers({
      processEnv: {
        IMAGE_PIPELINE_BACKFILL_ON_BOOT: 'true',
        IMAGE_PIPELINE_BACKFILL_LIMIT: '7',
      },
    });

    await helpers.service.startServer();

    assert.deepEqual(helpers.callOrder, [
      'connectDB',
      'ensureDbIndexes',
      'ensureDefaultPermissionDocs',
      'migrateBreakingCategoryLabels',
      'ensureGameDefinitions',
    ]);
    assert.deepEqual(helpers.app.listenCalls, [3001]);
    assert.equal(helpers.backgroundJobsStarted(), 1);
    assert.deepEqual(helpers.backfillPayload(), { force: false, limit: 7 });
    assert.equal(helpers.mongooseErrorHandlers.length, 1);
    assert.equal(helpers.mongooseErrorHandlers[0].event, 'error');
    await helpers.mongooseErrorHandlers[0].handler(new Error('db down'));
    assert.deepEqual(helpers.reportServerErrorPayload(), ['mongoose-connection', new Error('db down')]);
    assert.equal(helpers.processObject.handlers.has('SIGINT'), true);
    assert.equal(helpers.processObject.handlers.has('SIGTERM'), true);
    assert.equal(helpers.processObject.handlers.has('uncaughtException'), true);
    assert.equal(helpers.processObject.handlers.has('unhandledRejection'), true);
  }

  {
    const timers = createTimerHarness();
    const helpers = createHelpers({
      clearTimeoutImpl: timers.clearTimeoutImpl,
      setTimeoutImpl: timers.setTimeoutImpl,
    });
    const shutdown = helpers.service.registerGracefulShutdown(helpers.server);

    let socketClosedHandler = null;
    const socket = {
      destroyCalls: 0,
      endCalls: 0,
      on(event, handler) {
        if (event === 'close') socketClosedHandler = handler;
      },
      destroy() {
        this.destroyCalls += 1;
      },
      end() {
        this.endCalls += 1;
      },
    };

    helpers.server.handlers.get('connection')(socket);
    assert.equal(typeof socketClosedHandler, 'function');

    await shutdown('manual', 0);
    await shutdown('manual-again', 1);

    assert.equal(socket.endCalls, 1);
    assert.equal(socket.destroyCalls, 0);
    assert.equal(helpers.server.closeCalls, 1);
    assert.equal(helpers.server.closeIdleConnectionsCalls, 1);
    assert.equal(helpers.server.closeAllConnectionsCalls, 1);
    assert.equal(helpers.backgroundJobsStopped(), 1);
    assert.equal(helpers.mongooseCloseArg(), false);
    assert.deepEqual(helpers.processObject.exits, [0]);
    assert.equal(timers.scheduled.length, 2);
    assert.equal(timers.scheduled[0].ms, 12000);
    assert.equal(timers.scheduled[0].unrefCalled, true);
    assert.equal(timers.cleared.length, 2);
  }

  {
    const helpers = createHelpers({
      connectDB: async () => {
        throw new Error('mongo failed');
      },
    });
    await helpers.service.startServer();
    assert.deepEqual(helpers.app.listenCalls, []);
    assert.deepEqual(helpers.processObject.exits, [1]);
    assert.equal(helpers.errors.some((line) => line.includes('MongoDB error: mongo failed')), true);
  }

  {
    const helpers = createHelpers();
    await helpers.service.startServer();
    const errorHandler = helpers.server.handlers.get('error');
    errorHandler({ code: 'EADDRINUSE' });
    assert.deepEqual(helpers.processObject.exits, [1]);
    assert.equal(helpers.errors.some((line) => line.includes('already in use')), true);
  }
}
