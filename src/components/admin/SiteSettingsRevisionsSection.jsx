import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import SiteSettingsRevisionsList from './SiteSettingsRevisionsList';
import SiteSettingsRevisionComparePanel from './SiteSettingsRevisionComparePanel';

export default function SiteSettingsRevisionsSection({
  loadingHistory,
  siteSettingsRevisions,
  restoringHistory,
  handleRestoreHistory,
  onRefreshHistory,
  currentSnapshot,
}) {
  const [selectedRevisionIds, setSelectedRevisionIds] = useState([]);

  useEffect(() => {
    setSelectedRevisionIds((prev) => prev.filter((revisionId) => siteSettingsRevisions.some((revision) => revision.revisionId === revisionId)).slice(0, 2));
  }, [siteSettingsRevisions]);

  const toggleRevisionCompareSelection = (revisionId) => {
    setSelectedRevisionIds((prev) => {
      if (prev.includes(revisionId)) return prev.filter((item) => item !== revisionId);
      if (prev.length >= 2) return [prev[1], revisionId];
      return [...prev, revisionId];
    });
  };

  const restoreRevision = async (revisionId) => {
    await handleRestoreHistory(revisionId);
    setSelectedRevisionIds([]);
  };

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
          <History className="w-3.5 h-3.5" />
          Site settings revisions
        </div>
        <button
          onClick={onRefreshHistory}
          className="text-xs font-sans font-semibold text-zn-purple transition-colors hover:text-zn-purple-dark"
        >
          Обнови
        </button>
      </div>

      <SiteSettingsRevisionsList
        loadingHistory={loadingHistory}
        siteSettingsRevisions={siteSettingsRevisions}
        restoringHistory={restoringHistory}
        handleRestoreHistory={restoreRevision}
        selectedRevisionIds={selectedRevisionIds}
        toggleRevisionCompareSelection={toggleRevisionCompareSelection}
      />

      <div className="mt-4">
        <SiteSettingsRevisionComparePanel
          selectedRevisionIds={selectedRevisionIds}
          siteSettingsRevisions={siteSettingsRevisions}
          currentSnapshot={currentSnapshot}
        />
      </div>
    </>
  );
}
