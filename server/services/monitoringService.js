import { createHash } from 'crypto';

export function createMonitoringService(deps) {
  const {
    SystemEvent,
    systemEventRetentionDays,
  } = deps;

  function truncateMonitoringText(value, max = 500) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function sanitizeMonitoringMetadata(value, depth = 0) {
    if (value === null || value === undefined) return null;
    if (depth > 3) return '[depth-limit]';
    if (Array.isArray(value)) return value.slice(0, 12).map((item) => sanitizeMonitoringMetadata(item, depth + 1));
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value.slice(0, 2000);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return String(value).slice(0, 2000);
    const out = {};
    Object.entries(value).slice(0, 24).forEach(([key, entry]) => {
      out[String(key).slice(0, 80)] = sanitizeMonitoringMetadata(entry, depth + 1);
    });
    return out;
  }

  function serializeErrorForMonitoring(error) {
    if (!error) return null;
    if (typeof error === 'string') return { message: error.slice(0, 2000) };
    return sanitizeMonitoringMetadata({
      name: error.name || '',
      message: error.message || String(error),
      stack: error.stack || '',
      code: error.code || '',
      status: error.status || null,
    });
  }

  async function recordSystemEvent({ level = 'error', source = 'server', component = '', message = '', metadata = null } = {}) {
    const safeMessage = truncateMonitoringText(message || 'Unknown system event', 600);
    const fingerprint = createHash('sha1')
      .update(JSON.stringify({ source: String(source || ''), component: String(component || ''), message: safeMessage }))
      .digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (systemEventRetentionDays * 24 * 60 * 60 * 1000));
    try {
      await SystemEvent.findOneAndUpdate(
        { fingerprint },
        {
          $set: {
            level: ['info', 'warn', 'error'].includes(level) ? level : 'error',
            source: truncateMonitoringText(source, 80),
            component: truncateMonitoringText(component, 120),
            message: safeMessage,
            metadata: sanitizeMonitoringMetadata(metadata),
            lastSeenAt: now,
            expiresAt,
          },
          $setOnInsert: { firstSeenAt: now },
          $inc: { count: 1 },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Failed to record system event:', error?.message || error);
    }
  }

  function reportServerError(component, error, metadata = null) {
    console.error(`[monitor] ${component}:`, error);
    return recordSystemEvent({
      level: 'error',
      source: 'server',
      component,
      message: error?.message || String(error || 'Server error'),
      metadata: { ...(sanitizeMonitoringMetadata(metadata) || {}), error: serializeErrorForMonitoring(error) },
    });
  }

  return {
    truncateMonitoringText,
    sanitizeMonitoringMetadata,
    serializeErrorForMonitoring,
    recordSystemEvent,
    reportServerError,
  };
}
