import { describe, expect, it } from 'vitest';

import { createServerLifecycleService } from '../../server/services/serverLifecycleService.js';

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

describe('server lifecycle service', () => {
  it('starts the server, wires background jobs, and reports mongoose errors', async () => {
    const helpers = createHelpers({
      processEnv: {
        IMAGE_PIPELINE_BACKFILL_ON_BOOT: 'true',
        IMAGE_PIPELINE_BACKFILL_LIMIT: '7',
      },
    });

    await helpers.service.startServer();

    expect(helpers.callOrder).toEqual([
      'connectDB',
      'ensureDbIndexes',
      'ensureDefaultPermissionDocs',
      'migrateBreakingCategoryLabels',
      'ensureGameDefinitions',
    ]);
    expect(helpers.app.listenCalls).toEqual([3001]);
    expect(helpers.backgroundJobsStarted()).toBe(1);
    expect(helpers.backfillPayload()).toEqual({ force: false, limit: 7 });
    expect(helpers.mongooseErrorHandlers).toHaveLength(1);
    expect(helpers.mongooseErrorHandlers[0].event).toBe('error');
    const mongooseError = new Error('db down');
    await helpers.mongooseErrorHandlers[0].handler(mongooseError);
    expect(helpers.reportServerErrorPayload()).toEqual(['mongoose-connection', mongooseError]);
    expect(helpers.processObject.handlers.has('SIGINT')).toBe(true);
    expect(helpers.processObject.handlers.has('SIGTERM')).toBe(true);
    expect(helpers.processObject.handlers.has('uncaughtException')).toBe(true);
    expect(helpers.processObject.handlers.has('unhandledRejection')).toBe(true);
  });

  it('registers graceful shutdown handlers and closes resources exactly once', async () => {
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
    expect(typeof socketClosedHandler).toBe('function');

    await shutdown('manual', 0);
    await shutdown('manual-again', 1);

    expect(socket.endCalls).toBe(1);
    expect(socket.destroyCalls).toBe(0);
    expect(helpers.server.closeCalls).toBe(1);
    expect(helpers.server.closeIdleConnectionsCalls).toBe(1);
    expect(helpers.server.closeAllConnectionsCalls).toBe(1);
    expect(helpers.backgroundJobsStopped()).toBe(1);
    expect(helpers.mongooseCloseArg()).toBe(false);
    expect(helpers.processObject.exits).toEqual([0]);
    expect(timers.scheduled).toHaveLength(2);
    expect(timers.scheduled[0].ms).toBe(12000);
    expect(timers.scheduled[0].unrefCalled).toBe(true);
    expect(timers.scheduled[1].ms).toBe(12000);
    expect(timers.scheduled[1].unrefCalled).toBe(true);
    expect(timers.cleared).toHaveLength(2);
  });

  it('exits with code 1 when bootstrapping fails or the port is already in use', async () => {
    const bootFailure = createHelpers({
      connectDB: async () => {
        throw new Error('mongo failed');
      },
    });
    await bootFailure.service.startServer();
    expect(bootFailure.app.listenCalls).toEqual([]);
    expect(bootFailure.processObject.exits).toEqual([1]);
    expect(bootFailure.errors.some((line) => line.includes('MongoDB error: mongo failed'))).toBe(true);

    const portFailure = createHelpers();
    await portFailure.service.startServer();
    const errorHandler = portFailure.server.handlers.get('error');
    errorHandler({ code: 'EADDRINUSE' });
    expect(portFailure.processObject.exits).toEqual([1]);
    expect(portFailure.errors.some((line) => line.includes('already in use'))).toBe(true);
  });
});
