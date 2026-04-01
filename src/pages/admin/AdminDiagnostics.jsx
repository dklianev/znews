import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Database, HardDrive, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from '../../utils/api';

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' });
}

function formatMonitoringPathname(value) {
  const pathname = String(value || '').trim();
  return pathname || '-';
}

function getMonitoringComponentStack(event) {
  const stack = event?.metadata?.extra?.componentStack;
  return typeof stack === 'string' ? stack.trim() : '';
}

function getMonitoringErrorStack(event) {
  const stack = event?.metadata?.stack;
  return typeof stack === 'string' ? stack.trim() : '';
}

function formatUptime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatMemory(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '-';
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return new Intl.NumberFormat('bg-BG').format(Math.round(numeric));
}

function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return '-';
  return `${(numeric * 100).toFixed(1)}%`;
}

function formatCacheStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized || normalized === 'SKIP') return 'not cached';
  return normalized.toLowerCase();
}

function StatusPill({ tone = 'neutral', children }) {
  const className = tone === 'good'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : tone === 'warn'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : tone === 'bad'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-gray-50 text-gray-600 border-gray-200';
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-sans font-semibold ${className}`}>{children}</span>;
}

function StatCard({ icon: Icon, label, value, hint, tone = 'neutral' }) {
  const iconTone = tone === 'good' ? 'text-emerald-600 bg-emerald-50' : tone === 'warn' ? 'text-amber-600 bg-amber-50' : tone === 'bad' ? 'text-red-600 bg-red-50' : 'text-zn-purple bg-zn-purple/10';
  return (
    <div className="bg-white border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-display font-black text-gray-900">{value}</p>
          {hint ? <p className="mt-1 text-xs font-sans text-gray-500">{hint}</p> : null}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconTone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDiagnostics() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDiagnostics = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const next = await api.diagnostics.get();
      setPayload(next);
    } catch (fetchError) {
      setError(fetchError?.message || 'Failed to load diagnostics data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  const cacheTagRows = useMemo(() => {
    const entries = Object.entries(payload?.cache?.countsByTag || {});
    return entries.sort((left, right) => right[1] - left[1]);
  }, [payload?.cache?.countsByTag]);

  const jobFailures = useMemo(() => {
    const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
    return jobs.filter((job) => Number(job.failureCount || 0) > 0).length;
  }, [payload?.jobs]);

  const requestSummary = payload?.requestMetrics?.totals || {};
  const requestGroups = useMemo(() => {
    const groups = Array.isArray(payload?.requestMetrics?.groups) ? payload.requestMetrics.groups : [];
    return groups.filter((group) => group?.name !== 'api-diagnostics').slice(0, 6);
  }, [payload?.requestMetrics?.groups]);
  const topErrorGroups = useMemo(() => {
    const groups = Array.isArray(payload?.requestMetrics?.groups) ? payload.requestMetrics.groups : [];
    return groups
      .filter((group) => Number(group?.errorCount || 0) > 0)
      .sort((left, right) => (right.errorCount || 0) - (left.errorCount || 0) || (right.lastErrorStatusCode || 0) - (left.lastErrorStatusCode || 0))
      .slice(0, 5);
  }, [payload?.requestMetrics?.groups]);
  const recentErrorRequests = useMemo(() => {
    const requests = Array.isArray(payload?.requestMetrics?.recentRequests) ? payload.requestMetrics.recentRequests : [];
    return requests.filter((entry) => Number(entry?.statusCode || 0) >= 400).slice(0, 6);
  }, [payload?.requestMetrics?.recentRequests]);
  const slowRequests = useMemo(() => {
    const requests = Array.isArray(payload?.requestMetrics?.slowRequests) ? payload.requestMetrics.slowRequests : [];
    return requests.filter((entry) => entry?.group !== 'api-diagnostics').slice(0, 6);
  }, [payload?.requestMetrics?.slowRequests]);
  const cachePerformance = payload?.cache?.performance || {};

  const mediaReady = payload?.mediaPipeline?.ready ?? 0;
  const mediaPending = payload?.mediaPipeline?.pending ?? 0;
  const mongoState = payload?.mongo?.state || 'unknown';
  const mongoTone = mongoState === 'connected' ? 'good' : mongoState === 'connecting' ? 'warn' : 'bad';

  if (loading && !payload) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 text-sm font-sans text-gray-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading diagnostics...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Diagnostics</h1>
          <p className="mt-1 text-sm font-sans text-gray-500">Health, cache, jobs, media pipeline, and recent error activity.</p>
        </div>
        <button
          type="button"
          onClick={() => loadDiagnostics({ silent: true })}
          className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 text-sm font-sans font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm font-sans text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Database} label="Mongo" value={mongoState} hint={payload?.mongo?.name || 'database'} tone={mongoTone} />
        <StatCard icon={Activity} label="Uptime" value={formatUptime(payload?.app?.uptimeSeconds)} hint={`Env: ${payload?.app?.env || 'unknown'}`} tone="neutral" />
        <StatCard icon={HardDrive} label="Cache Keys" value={String(payload?.cache?.keyCount ?? 0)} hint={`TTL ${payload?.cache?.ttlSeconds ?? 0}s`} tone="neutral" />
        <StatCard icon={ShieldAlert} label="Job Failures" value={String(jobFailures)} hint={`${(payload?.jobs || []).length || 0} jobs tracked`} tone={jobFailures > 0 ? 'warn' : 'good'} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="bg-white border border-gray-200 p-5 xl:col-span-1">
          <h2 className="text-sm font-sans font-bold uppercase tracking-wider text-gray-500">Service</h2>
          <div className="mt-4 space-y-3 text-sm font-sans text-gray-700">
            <div className="flex items-center justify-between gap-4">
              <span>Generated</span>
              <span className="font-semibold">{formatDateTime(payload?.generatedAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Heap Used</span>
              <span className="font-semibold">{formatMemory(payload?.app?.memory?.heapUsed)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Storage Driver</span>
              <span className="font-semibold">{payload?.storage?.driver || '-'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Remote Storage</span>
              <StatusPill tone={payload?.storage?.remote ? 'good' : 'neutral'}>{payload?.storage?.remote ? 'Yes' : 'No'}</StatusPill>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Media Pipeline</span>
              <StatusPill tone={mediaPending > 0 ? 'warn' : 'good'}>{mediaReady} ready / {mediaPending} pending</StatusPill>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Upload Dedup Cache</span>
              <span className="font-semibold">{payload?.storage?.uploadDedupCacheSize ?? 0}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Inflight Uploads</span>
              <span className="font-semibold">{payload?.storage?.uploadInFlight ?? 0}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Request Metrics Since</span>
              <span className="font-semibold">{formatDateTime(payload?.requestMetrics?.startedAt)}</span>
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 p-5 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-sans font-bold uppercase tracking-wider text-gray-500">Background Jobs</h2>
            <StatusPill tone={(payload?.jobs || []).some((job) => job.running) ? 'warn' : 'neutral'}>{(payload?.jobs || []).filter((job) => job.running).length} running</StatusPill>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="pb-2 pr-4">Job</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Last Success</th>
                  <th className="pb-2 pr-4">Runs</th>
                  <th className="pb-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.jobs || []).map((job) => (
                  <tr key={job.name} className="border-b border-gray-100 align-top">
                    <td className="py-3 pr-4 font-semibold text-gray-900">{job.name}</td>
                    <td className="py-3 pr-4">
                      <StatusPill tone={job.running ? 'warn' : Number(job.failureCount || 0) > 0 ? 'warn' : 'good'}>
                        {job.running ? 'running' : 'idle'}
                      </StatusPill>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{formatDateTime(job.lastSuccessAt)}</td>
                    <td className="py-3 pr-4 text-gray-600">{job.runCount || 0}</td>
                    <td className="py-3 text-gray-600">{job.lastMessage || '-'}</td>
                  </tr>
                ))}
                {(payload?.jobs || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-sm text-gray-400">No background jobs tracked yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="bg-white border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-sans font-bold uppercase tracking-wider text-gray-500">Request Metrics</h2>
          <StatusPill tone={slowRequests.length > 0 ? 'warn' : 'good'}>{formatInteger(requestSummary.requests ?? 0)} tracked</StatusPill>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Requests</p>
            <p className="mt-2 text-xl font-display font-black text-gray-900">{formatInteger(requestSummary.requests ?? 0)}</p>
          </div>
          <div className="border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Errors</p>
            <p className="mt-2 text-xl font-display font-black text-gray-900">{formatInteger(requestSummary.errors ?? 0)}</p>
          </div>
          <div className="border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Cache Hit Rate</p>
            <p className="mt-2 text-xl font-display font-black text-gray-900">{formatPercent(requestSummary.hitRate)}</p>
          </div>
          <div className="border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Slow Requests</p>
            <p className="mt-2 text-xl font-display font-black text-gray-900">{formatInteger(slowRequests.length)}</p>
          </div>
          <div className="border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Slow Threshold</p>
            <p className="mt-2 text-xl font-display font-black text-gray-900">{payload?.requestMetrics?.slowRequestThresholdMs ?? 0} ms</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="overflow-x-auto">
            <p className="mb-2 text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Slowest Groups</p>
            <table className="min-w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="pb-2 pr-4">Group</th>
                  <th className="pb-2 pr-4">Count</th>
                  <th className="pb-2 pr-4">Avg</th>
                  <th className="pb-2 pr-4">Max</th>
                  <th className="pb-2 pr-4">Errors</th>
                  <th className="pb-2">Cache</th>
                </tr>
              </thead>
              <tbody>
                {requestGroups.map((group) => (
                  <tr key={group.name} className="border-b border-gray-100 align-top">
                    <td className="py-3 pr-4 font-semibold text-gray-900">{group.name}</td>
                    <td className="py-3 pr-4 text-gray-600">{formatInteger(group.count || 0)}</td>
                    <td className="py-3 pr-4 text-gray-600">{group.avgDurationMs} ms</td>
                    <td className="py-3 pr-4 text-gray-600">{group.maxDurationMs} ms</td>
                    <td className="py-3 pr-4 text-gray-600">{group.errorCount || 0}</td>
                    <td className="py-3 text-gray-600">{group.cacheHits || 0} hit / {group.cacheMisses || 0} miss</td>
                  </tr>
                ))}
                {requestGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-sm text-gray-400">No request metrics captured yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <p className="mb-2 text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Top Error Groups</p>
            <table className="min-w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="pb-2 pr-4">Group</th>
                  <th className="pb-2 pr-4">Errors</th>
                  <th className="pb-2 pr-4">Last Error</th>
                  <th className="pb-2">Last Error Path</th>
                </tr>
              </thead>
              <tbody>
                {topErrorGroups.map((group) => (
                  <tr key={group.name} className="border-b border-gray-100 align-top">
                    <td className="py-3 pr-4 font-semibold text-gray-900">{group.name}</td>
                    <td className="py-3 pr-4 text-gray-600">{group.errorCount || 0}</td>
                    <td className="py-3 pr-4 text-gray-600">{group.lastErrorStatusCode || '-'}</td>
                    <td className="py-3 text-gray-600">{group.lastErrorPath || '-'}</td>
                  </tr>
                ))}
                {topErrorGroups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-sm text-gray-400">No error groups captured.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Recent Slow Requests</p>
            {slowRequests.map((entry, index) => (
              <div key={`${entry.at}-${index}`} className="border border-gray-100 px-3 py-2 text-xs font-sans text-gray-600">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-gray-800">{entry.group}</span>
                  <span>{entry.durationMs} ms</span>
                </div>
                <p className="mt-1">{entry.method} {entry.path} | {entry.statusCode} | {formatCacheStatus(entry.cacheStatus)}</p>
              </div>
            ))}
            {slowRequests.length === 0 ? <p className="text-sm font-sans text-gray-400">No slow requests captured.</p> : null}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Recent Error Requests</p>
            {recentErrorRequests.map((entry, index) => (
              <div key={`${entry.at}-${index}`} className="border border-gray-100 px-3 py-2 text-xs font-sans text-gray-600">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-gray-800">{entry.group}</span>
                  <span>{entry.statusCode}</span>
                </div>
                <p className="mt-1">{entry.method} {entry.path} | {entry.durationMs} ms | {formatCacheStatus(entry.cacheStatus)}</p>
              </div>
            ))}
            {recentErrorRequests.length === 0 ? <p className="text-sm font-sans text-gray-400">No recent error requests captured.</p> : null}
          </div>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="bg-white border border-gray-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-sans font-bold uppercase tracking-wider text-gray-500">Cache Tags</h2>
            <StatusPill tone={Number(cachePerformance.hitRate || 0) >= 0.6 ? 'good' : Number(cachePerformance.hitRate || 0) > 0 ? 'warn' : 'neutral'}>{formatPercent(cachePerformance.hitRate)}</StatusPill>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-sans text-gray-700">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Hits</span>
              <p className="mt-1 font-semibold text-gray-900">{cachePerformance.hits ?? 0}</p>
            </div>
            <div className="border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-sans text-gray-700">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Misses</span>
              <p className="mt-1 font-semibold text-gray-900">{cachePerformance.misses ?? 0}</p>
            </div>
            <div className="border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-sans text-gray-700">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Writes</span>
              <p className="mt-1 font-semibold text-gray-900">{cachePerformance.writes ?? 0}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cacheTagRows.map(([tag, count]) => (
              <div key={tag} className="flex items-center justify-between border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-sans text-gray-700">
                <span>{tag}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
            {cacheTagRows.length === 0 ? <p className="text-sm font-sans text-gray-400">No cache tag data yet.</p> : null}
          </div>
          <div className="mt-5 space-y-2">
            <p className="text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Recent Invalidations</p>
            {(payload?.cache?.recentInvalidations || []).map((entry, index) => (
              <div key={`${entry.at}-${index}`} className="border border-gray-100 px-3 py-2 text-xs font-sans text-gray-600">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-gray-800">{entry.reason || 'manual'}</span>
                  <span>{formatDateTime(entry.at)}</span>
                </div>
                <p className="mt-1">{entry.keyCount || 0} keys via {(entry.tags || []).join(', ') || 'pattern'}</p>
              </div>
            ))}
            {(payload?.cache?.recentInvalidations || []).length === 0 ? <p className="text-sm font-sans text-gray-400">No recent invalidations recorded.</p> : null}
          </div>
        </section>

        <section className="bg-white border border-gray-200 p-5">
          <h2 className="text-sm font-sans font-bold uppercase tracking-wider text-gray-500">Monitoring</h2>
          <div className="mt-4 space-y-3">
            {(payload?.monitoring?.recentErrors || []).map((event) => (
              <div key={event.fingerprint} className="border border-gray-100 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusPill tone={event.level === 'error' ? 'bad' : event.level === 'warn' ? 'warn' : 'neutral'}>{event.level}</StatusPill>
                    <span className="text-xs font-sans font-semibold text-gray-800">{event.source} / {event.component || 'general'}</span>
                  </div>
                  <span className="text-[11px] font-sans text-gray-500">{formatDateTime(event.lastSeenAt)}</span>
                </div>
                <p className="mt-2 text-sm font-sans text-gray-700">{event.message}</p>
                <p className="mt-1 text-[11px] font-sans text-gray-500">Seen {event.count || 1} times</p>
                <div className="mt-2 space-y-1 text-[11px] font-sans text-gray-500">
                  <p><span className="font-semibold text-gray-700">Път:</span> {formatMonitoringPathname(event?.metadata?.pathname)}</p>
                  {getMonitoringComponentStack(event) ? (
                    <details className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
                      <summary className="cursor-pointer font-semibold text-gray-700">Компонентен стек</summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-gray-600">{getMonitoringComponentStack(event)}</pre>
                    </details>
                  ) : null}
                  {getMonitoringErrorStack(event) ? (
                    <details className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
                      <summary className="cursor-pointer font-semibold text-gray-700">JS стек</summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-gray-600">{getMonitoringErrorStack(event)}</pre>
                    </details>
                  ) : null}
                </div>
              </div>
            ))}
            {(payload?.monitoring?.recentErrors || []).length === 0 ? <p className="text-sm font-sans text-gray-400">No recent monitoring events.</p> : null}
          </div>
        </section>
      </div>

      <section className="bg-white border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-sans font-bold uppercase tracking-wider text-gray-500">Ad Analytics Rollup</h2>
          <StatusPill tone="neutral">{payload?.adAnalytics?.latestBucket?.bucketDate || 'no buckets yet'}</StatusPill>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Impressions (7d)</p>
            <p className="mt-2 text-2xl font-display font-black text-gray-900">{payload?.adAnalytics?.last7Days?.impressions ?? 0}</p>
          </div>
          <div className="border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Clicks (7d)</p>
            <p className="mt-2 text-2xl font-display font-black text-gray-900">{payload?.adAnalytics?.last7Days?.clicks ?? 0}</p>
          </div>
          <div className="border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[11px] font-sans font-bold uppercase tracking-wider text-gray-500">Aggregate Rows</p>
            <p className="mt-2 text-2xl font-display font-black text-gray-900">{payload?.adAnalytics?.last7Days?.rows ?? 0}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
