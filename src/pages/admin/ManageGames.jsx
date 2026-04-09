import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../utils/api';
import { useToast } from '../../components/admin/Toast';
import { Gamepad2, Loader2, Check, X, RefreshCw } from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import AdminSearchField from '../../components/admin/AdminSearchField';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { buildAdminSearchParams, readSearchParam } from '../../utils/adminSearchParams';

export default function ManageGames() {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const query = readSearchParam(searchParams, 'q', '');
    const toast = useToast();

    const setListSearchParams = (updates) => {
        setSearchParams(
            (current) => buildAdminSearchParams(current, updates),
            { replace: true },
        );
    };

    const loadGames = async () => {
        setLoading(true);
        try {
            const data = await api.adminGames.getAll();
            setGames(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error('Грешка при зареждане на игрите: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGames();
    }, []);

    const filteredGames = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return games;
        return games.filter((game) =>
            String(game.id || '').toLowerCase().includes(normalizedQuery)
            || String(game.slug || '').toLowerCase().includes(normalizedQuery)
            || String(game.title || '').toLowerCase().includes(normalizedQuery)
            || String(game.description || '').toLowerCase().includes(normalizedQuery)
        );
    }, [games, query]);

    const toggleActive = async (game) => {
        setSavingId(game.id);
        try {
            const updated = await api.adminGames.update(game.id, { active: !game.active });
            setGames(games.map(g => g.id === game.id ? updated : g));
            toast.success(`${game.title} е вече ${!game.active ? 'активна' : 'неактивна'}`);
        } catch (e) {
            toast.error('Грешка при запазване: ' + e.message);
        } finally {
            setSavingId(null);
        }
    };

    if (loading && games.length === 0) {
        return (
            <div className="p-8 flex justify-center">
                <Loader2 className="w-8 h-8 text-zn-purple animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <AdminPageHeader
                title="Управление на Игри"
                description="Активирайте или деактивирайте модулите с игри (Word, Connections, Ерудит, Судоку)."
                icon={Gamepad2}
                actions={(
                    <button
                        onClick={loadGames}
                        className="rounded bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900"
                        aria-label="Презареди игрите"
                        title="Презареди"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>
                )}
            />

            <AdminFilterBar className="mb-6">
                <AdminSearchField
                    value={query}
                    onChange={(event) => setListSearchParams({ q: event.target.value })}
                    placeholder="Търси игра по име, slug или описание"
                    ariaLabel="Търси игра по име, slug или описание"
                />
            </AdminFilterBar>

            <div className="bg-white border border-gray-200 overflow-hidden shadow-sm">
                {filteredGames.length === 0 ? (
                    <AdminEmptyState
                        title={games.length === 0 ? 'Няма игри' : 'Няма съвпадения'}
                        description={games.length === 0
                            ? 'Няма намерени дефиниции на игри. Моля стартирайте seed скрипта.'
                            : 'Промени търсенето, за да видиш съвпадащи игрови модули.'}
                        className="m-4"
                    />
                ) : (
                    <table className="w-full text-left font-sans text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-gray-500 text-xs">ID / Slug</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-gray-500 text-xs">Име / Описание</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-gray-500 text-xs text-center">Статус</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-gray-500 text-xs text-right">Действие</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredGames.map(game => (
                                <tr key={game.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-gray-900">{game.id}</p>
                                        <p className="text-xs text-gray-500 bg-gray-100 inline-block px-1.5 py-0.5 rounded mt-1">{game.slug}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-gray-900 text-base">{game.title}</p>
                                        <p className="text-gray-500 mt-1">{game.description}</p>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {game.active ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-bold text-xs uppercase tracking-wider">
                                                <Check className="w-3.5 h-3.5" /> Активна
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-bold text-xs uppercase tracking-wider">
                                                <X className="w-3.5 h-3.5" /> Неактивна
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => toggleActive(game)}
                                            disabled={savingId === game.id}
                                            className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${game.active
                                                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                                    : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                                                }`}
                                        >
                                            {savingId === game.id ? <Loader2 className="w-4 h-4 animate-spin" /> : game.active ? 'Спри' : 'Пусни'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 text-blue-800 text-sm font-sans flex items-start gap-2">
                ℹ️ За да създадете пъзели към активните игри, отидете в меню "Игрови Пъзели".
            </div>
        </div>
    );
}


