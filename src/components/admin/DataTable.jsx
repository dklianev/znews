/**
 * Shared admin DataTable component.
 *
 * Usage:
 *   <DataTable
 *     columns={[
 *       { key: 'name', label: 'Име', render: (val, row) => <strong>{val}</strong> },
 *       { key: 'role', label: 'Роля' },
 *       { key: 'actions', label: 'Действия', align: 'right', render: (_v, row) => <button>...</button> },
 *     ]}
 *     data={items}
 *     rowKey="id"
 *     emptyMessage="Няма записи"
 *   />
 */

const thCls = 'text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500';
const tdCls = 'px-4 py-3 text-sm font-sans text-gray-700';

export default function DataTable({ columns, data, rowKey = 'id', emptyMessage = 'Няма записи' }) {
  return (
    <div className="bg-white border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${thCls} ${col.align === 'right' ? '!text-right' : ''} ${col.className || ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row[rowKey]} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`${tdCls} ${col.align === 'right' ? 'text-right' : ''} ${col.cellClassName || ''}`}
                >
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="text-center py-12 text-sm font-sans text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
