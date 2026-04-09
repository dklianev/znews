export default function RevisionComparePanel({
  title,
  subtitle,
  compare,
  loading = false,
  error = '',
  emptyMessage = 'Няма избрани версии за сравнение.',
}) {
  const groupedRows = compare
    ? compare.rows.reduce((groups, row) => {
      const groupKey = row.group || 'Други';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(row);
      return groups;
    }, {})
    : {};
  const groupEntries = Object.entries(groupedRows);

  return (
    <div className="border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-1 text-xs font-sans text-gray-400">{subtitle}</p>
        ) : null}
      </div>

      {loading && <p className="py-2 text-xs font-sans text-gray-400">Зареждане на сравнение...</p>}
      {!loading && error ? <p className="py-2 text-xs font-sans text-red-600">{error}</p> : null}
      {!loading && !error && !compare ? (
        <p className="py-2 text-xs font-sans text-gray-400">{emptyMessage}</p>
      ) : null}

      {!loading && !error && compare ? (
        <>
          <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-2 text-[11px] font-sans text-gray-600">
            <span className="bg-red-50 px-2 py-0.5 font-semibold text-red-500">{compare.leftLabel}</span>
            <span>срещу</span>
            <span className="bg-green-50 px-2 py-0.5 font-semibold text-green-600">{compare.rightLabel}</span>
            <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
              {compare.rows.length} разлики
            </span>
          </div>

          <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
            {groupEntries.map(([groupLabel, rows]) => (
              <div key={groupLabel} className="space-y-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                  <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
                    {groupLabel}
                  </p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-sans font-semibold text-gray-500">
                    {rows.length}
                  </span>
                </div>
                {rows.map((row) => (
                  <div key={row.key} className="border border-gray-100 bg-gray-50 p-3 sm:grid sm:grid-cols-2 sm:gap-4">
                    <div className="col-span-2 mb-1 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400">
                      {row.label}
                    </div>
                    <div className="break-words whitespace-pre-wrap border border-red-100/50 bg-red-50/50 p-2 text-xs text-red-700">
                      {row.left}
                    </div>
                    <div className="mt-2 break-words whitespace-pre-wrap border border-green-100/50 bg-green-50/50 p-2 text-xs text-green-800 sm:mt-0">
                      {row.right}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {compare.rows.length === 0 ? (
              <p className="py-2 text-xs font-sans text-gray-400">Няма открити разлики.</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
