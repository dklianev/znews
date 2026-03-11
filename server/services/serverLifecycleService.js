export function createServerLifecycleService({
  app,
  backfillImagePipeline,
  connectDB,
  ensureDbIndexes,
  ensureDefaultPermissionDocs,
  ensureGameDefinitions,
  getShuttingDown,
  isProd,
  logError = (...args) => console.error(...args),
  logInfo = (...args) => console.log(...args),
  logWarning = (...args) => console.warn(...args),
  migrateBreakingCategoryLabels,
  mongoose,
  port,
  processEnv = process.env,
  processObject = process,
  reportServerError,
  setShuttingDown,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  startBackgroundJobs,
  stopBackgroundJobs,
}) {
  function registerGracefulShutdown(server) {
    const sockets = new Set();
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });

    const shutdown = async (reason, exitCode = 0) => {
      if (getShuttingDown()) return;
      setShuttingDown(true);

      try {
        logInfo(`\nGraceful shutdown: ${reason}`);

        const closePromise = new Promise((resolve) => server.close(resolve));

        sockets.forEach((socket) => {
          try {
            socket.end();
          } catch {}
        });

        const forceShutdownMs = 12_000;
        const forceTimer = setTimeoutImpl(() => {
          logWarning(`Forcing shutdown after ${forceShutdownMs}ms`);
          sockets.forEach((socket) => {
            try {
              socket.destroy();
            } catch {}
          });
        }, forceShutdownMs);
        if (typeof forceTimer?.unref === 'function') {
          forceTimer.unref();
        }

        let waitTimer = null;
        const waitPromise = new Promise((resolve) => {
          waitTimer = setTimeoutImpl(resolve, forceShutdownMs);
        });

        await Promise.race([closePromise, waitPromise]);

        if (typeof server.closeIdleConnections === 'function') {
          server.closeIdleConnections();
        }
        if (typeof server.closeAllConnections === 'function') {
          server.closeAllConnections();
        }

        stopBackgroundJobs();

        try {
          await mongoose.connection.close(false);
        } catch (error) {
          logError('Failed to close MongoDB connection:', error?.message || error);
        }

        clearTimeoutImpl(forceTimer);
        if (waitTimer) {
          clearTimeoutImpl(waitTimer);
        }
      } finally {
        processObject.exit(exitCode);
      }
    };

    ['SIGINT', 'SIGTERM'].forEach((signal) => {
      processObject.once(signal, () => {
        shutdown(signal, 0);
      });
    });

    processObject.once('uncaughtException', (error) => {
      logError('Uncaught exception:', error);
      shutdown('uncaughtException', 1);
    });

    processObject.once('unhandledRejection', (reason) => {
      logError('Unhandled rejection:', reason);
      shutdown('unhandledRejection', 1);
    });

    return shutdown;
  }

  async function startServer() {
    try {
      await connectDB();
      await ensureDbIndexes();
      await ensureDefaultPermissionDocs();
      await migrateBreakingCategoryLabels();
      await ensureGameDefinitions();
      mongoose.connection.on('error', (error) => {
        reportServerError('mongoose-connection', error).catch(() => {});
      });
    } catch (err) {
      logError('MongoDB error:', err?.message || err);
      processObject.exit(1);
      return;
    }

    const server = app.listen(port, () => {
      startBackgroundJobs();
      logInfo(`Los Santos News API running on port ${port}`);
      if (!isProd) logInfo('Running in development mode');

      if (processEnv.IMAGE_PIPELINE_BACKFILL_ON_BOOT === 'true') {
        const parsedLimit = Number.parseInt(processEnv.IMAGE_PIPELINE_BACKFILL_LIMIT || '', 10);
        const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 0;
        backfillImagePipeline({ force: false, limit })
          .then((summary) => {
            logInfo(
              `Image pipeline backfill finished (${summary.generated} generated, ${summary.skipped} skipped, ${summary.failed} failed, synced=${summary.syncedArticleMeta}/${summary.syncedTipMeta}, engine=${summary.engine})`
            );
          })
          .catch((error) => {
            logError('Image pipeline backfill failed on boot:', error?.message || error);
          });
      }
    });

    registerGracefulShutdown(server);

    server.on('error', (error) => {
      if (error?.code === 'EADDRINUSE') {
        logError(`Port ${port} is already in use`);
        logError('Stop the running process on that port, then start the server again.');
        logError('PowerShell: netstat -ano | findstr :3001');
        logError('PowerShell: Stop-Process -Id <PID_FROM_NETSTAT> -Force');
        processObject.exit(1);
        return;
      }

      logError('Server failed to start:', error);
      processObject.exit(1);
    });
  }

  return {
    registerGracefulShutdown,
    startServer,
  };
}
