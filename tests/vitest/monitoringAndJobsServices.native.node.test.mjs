import { describe, expect, it, vi } from 'vitest';
import { createMonitoringService } from '../../server/services/monitoringService.js';
import { createBackgroundJobsService } from '../../server/services/backgroundJobsService.js';

describe('monitoringAndJobsServices', () => {
  it('sanitizes monitoring payloads and reports server errors through system events', async () => {
    const findOneAndUpdate = vi.fn(async () => ({}));
    const service = createMonitoringService({
      SystemEvent: { findOneAndUpdate },
      systemEventRetentionDays: 7,
    });

    const metadata = service.sanitizeMonitoringMetadata({
      nested: { very: { deep: { still: { tooDeep: true } } } },
      list: Array.from({ length: 20 }, (_, index) => index),
    });
    expect(metadata.nested.very.deep.still).toBe('[depth-limit]');
    expect(metadata.list).toHaveLength(12);

    await service.reportServerError('article-page', new Error('boom'), { route: '/article/27' });
    expect(findOneAndUpdate).toHaveBeenCalled();
    expect(findOneAndUpdate.mock.calls[0][1].$set.component).toBe('article-page');
  });

  it('runs background jobs with locking, success metrics and failure monitoring', async () => {
    vi.useFakeTimers();
    const createdStates = [];
    const updates = [];
    const recordSystemEvent = vi.fn(async () => {});

    const service = createBackgroundJobsService({
      BackgroundJobState: {
        updateOne: vi.fn(async (...args) => {
          updates.push(args);
          return {};
        }),
        findOneAndUpdate: vi.fn((_filter, update) => {
          createdStates.push(update);
          return {
            lean: async () => ({ lastFailureAt: null, metrics: null }),
          };
        }),
      },
      backgroundJobLockMs: 1000,
      recordSystemEvent,
      sanitizeMonitoringMetadata: (value) => value,
      serializeErrorForMonitoring: (error) => ({ message: error.message }),
      shouldDisableBackgroundJobs: () => false,
      truncateMonitoringText: (value) => String(value || '').slice(0, 300),
    });

    const successRun = vi.fn(async () => ({ message: 'done', metrics: { processed: 2 } }));
    const failureRun = vi.fn(async () => { throw new Error('job failed'); });
    service.registerBackgroundJob({ name: 'job-success', run: successRun, initialDelayMs: 500, intervalMs: 2000 });
    service.registerBackgroundJob({ name: 'job-failure', run: failureRun, initialDelayMs: 500, intervalMs: 2000 });

    service.startBackgroundJobs();
    await vi.advanceTimersByTimeAsync(600);

    expect(successRun).toHaveBeenCalled();
    expect(failureRun).toHaveBeenCalled();
    expect(createdStates).toHaveLength(2);
    expect(updates).not.toHaveLength(0);
    expect(recordSystemEvent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'job',
      component: 'job-failure',
    }));

    service.stopBackgroundJobs();
    vi.useRealTimers();
  });
});
