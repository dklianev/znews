import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Plus, Pencil, Trash2, Filter, Clock, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useData } from '../../context/DataContext';

const ACTION_ICONS = { create: Plus, update: Pencil, delete: Trash2 };
const ACTION_COLORS = { create: 'bg-emerald-100 text-emerald-700', update: 'bg-blue-100 text-blue-700', delete: 'bg-red-100 text-red-700' };
const ACTION_LABELS = { create: 'Създаване', update: 'Редакция', delete: 'Изтриване' };

const RESOURCE_LABELS = {
    articles: 'Статии', authors: 'Автори', ads: 'Реклами', users: 'Потребители',
    wanted: 'Издирвани', jobs: 'Работа', court: 'Съд', events: 'Събития',
    polls: 'Анкети', comments: 'Коментари', gallery: 'Галерия', unknown: 'Друго',
};

export default function ManageAuditLog() {
    const { session, hasPermission } = useData();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterResource, setFilterResource] = useState('all');

    useEffect(() => {
        if (!session?.token) {
            setLogs([]);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setError('');
        (async () => {
            try {
                const res = await fetch('/api/audit-log', {
                    headers: { Authorization: `Bearer ${session?.token || ''}` },
                });
                if (!res.ok) {
                    const payload = await res.json().catch(() => null);
                    throw new Error(payload?.error || `Audit log failed (${res.status})`);
                }
                const data = await res.json();
                if (!cancelled) setLogs(data);
            } catch (e) {
                if (!cancelled) {
                    setLogs([]);
                    setError(e?.message || 'Грешка при зареждане на audit log');
                }
            }
            if (!cancelled) setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [session?.token]);

    const filtered = filterResource === 'all' ? logs : logs.filter(l => l.resource === filterResource);
    const resources = [...new Set(logs.map(l => l.resource))];

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <ClipboardList className="w-6 h-6 text-zn-purple" />
                    Журнал на действията
                </h1>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                        value={filterResource}
                        onChange={e => setFilterResource(e.target.value)}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                    >
                        <option value="all">Всички</option>
                        {resources.map(r => (
                            <option key={r} value={r}>{RESOURCE_LABELS[r] || r}</option>
                        ))}
                    </select>
                </div>
            </div>

            {!hasPermission('permissions') ? (
                <div className="bg-red-50 border border-red-200 p-6 text-center">
                    <ShieldAlert className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="font-sans text-red-700 font-semibold">Нямате достъп до тази страница</p>
                    <p className="font-sans text-red-500 text-sm mt-1">Нужни са права за управление на permissions</p>
                </div>
            ) : (
                <>
                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span className="break-words">{error}</span>
                        </div>
                    )}

            {loading ? (
                <div className="text-center py-12 text-gray-400">Зареждане...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-400">Няма записи</div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-gray-600 text-left">
                                <th className="px-4 py-3 font-semibold">Действие</th>
                                <th className="px-4 py-3 font-semibold">Потребител</th>
                                <th className="px-4 py-3 font-semibold">Ресурс</th>
                                <th className="px-4 py-3 font-semibold">Детайли</th>
                                <th className="px-4 py-3 font-semibold">Дата</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((log, i) => {
                                const Icon = ACTION_ICONS[log.action] || ClipboardList;
                                const colorClass = ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700';
                                return (
                                    <motion.tr
                                        key={i}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.02 }}
                                        className="border-t border-gray-100 hover:bg-gray-50"
                                    >
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
                                                <Icon className="w-3.5 h-3.5" />
                                                {ACTION_LABELS[log.action] || log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-800">{log.user}</td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {RESOURCE_LABELS[log.resource] || log.resource}
                                            <span className="text-gray-400 ml-1">#{log.resourceId}</span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]">{log.details || '—'}</td>
                                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(log.timestamp).toLocaleString('bg-BG')}
                                            </span>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
                </>
            )}
        </div>
    );
}
