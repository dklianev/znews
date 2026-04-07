import { RotateCcw } from 'lucide-react';

export default function SiteSettingsRevisionsList({
  loadingHistory,
  siteSettingsRevisions,
  restoringHistory,
  handleRestoreHistory,
}) {
  return (
    <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
      {loadingHistory && <p className="py-2 text-xs font-sans text-gray-400">Зареждане на версии...</p>}
      {!loadingHistory && siteSettingsRevisions.slice(0, 30).map((revision) => (
        <div key={revision.revisionId} className="flex items-center justify-between gap-2 border border-gray-200 bg-white px-2.5 py-1.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-sans font-semibold text-gray-700">
              v{revision.version} · {revision.source}
            </p>
            <p className="text-[10px] font-sans text-gray-400">
              {new Date(revision.createdAt).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleRestoreHistory(revision.revisionId)}
            disabled={restoringHistory === revision.revisionId}
            className="inline-flex items-center gap-1 border border-zn-purple/30 px-2 py-1 text-[10px] font-sans font-semibold text-zn-purple transition-colors hover:bg-zn-purple/5 disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            {restoringHistory === revision.revisionId ? '...' : 'Restore'}
          </button>
        </div>
      ))}
      {!loadingHistory && siteSettingsRevisions.length === 0 && (
        <p className="py-2 text-xs font-sans text-gray-400">Няма запазени версии на Site settings.</p>
      )}
    </div>
  );
}
