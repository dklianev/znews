import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Shield, Save, Check, X, AlertTriangle } from 'lucide-react';

const SECTION_LABELS = {
    articles: 'Статии',
    categories: 'Категории',
    ads: 'Реклами',
    breaking: 'Тикер / Спешни',
    wanted: 'Издирвани',
    jobs: 'Обяви',
    court: 'Съд',
    events: 'Събития',
    polls: 'Анкети',
    comments: 'Коментари',
    contact: 'Контакти',
    gallery: 'Галерия',
    profiles: 'Профили',
    permissions: 'Права',
};

const ROLE_LABELS = {
    admin: 'Администратор',
    editor: 'Редактор',
    reporter: 'Репортер',
    photographer: 'Фотограф',
    intern: 'Стажант',
};

const BASE_ROLES = Object.freeze(['admin', 'editor', 'reporter', 'photographer', 'intern']);
const sections = Object.keys(SECTION_LABELS);

function ensureRoleRows(value) {
    const items = Array.isArray(value) ? value : [];
    const byRole = new Map(items.map(p => [p?.role, p]).filter(([role]) => role));
    const baseRows = BASE_ROLES.map(role => byRole.get(role) || { role, permissions: {} });
    const extras = items.filter(p => p?.role && !BASE_ROLES.includes(p.role));
    return [...baseRows, ...extras];
}

export default function ManagePermissions() {
    const { permissions, updatePermission, session, hasPermission } = useData();
    const [saving, setSaving] = useState(null);
    const [localPerms, setLocalPerms] = useState(null);
    const [error, setError] = useState('');

    // Use local copy for editing, fall back to fetched data
    const permsToShow = ensureRoleRows(localPerms || permissions);

    if (!session || !hasPermission('permissions')) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 p-6 text-center">
                    <Shield className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="font-sans text-red-700 font-semibold">Нямате достъп до тази страница</p>
                    <p className="font-sans text-red-500 text-sm mt-1">Нужни са права за управление на permissions</p>
                </div>
            </div>
        );
    }

    const toggle = (role, section) => {
        if (role === 'admin') return; // Can't edit admin permissions
        setLocalPerms((prev) => {
            const base = ensureRoleRows(Array.isArray(prev) ? prev : permissions);
            return base.map((perm) => {
                const nextPerms = { ...(perm.permissions || {}) };
                if (perm.role === role) {
                    nextPerms[section] = !Boolean(nextPerms[section]);
                }
                return { ...perm, permissions: nextPerms };
            });
        });
    };

    const handleSave = async (role) => {
        const roleObj = permsToShow.find(p => p.role === role);
        if (!roleObj) return;
        setSaving(role);
        setError('');
        try {
            await updatePermission(role, roleObj.permissions);
        } catch (e) {
            setError(e?.message || 'Неуспешен запис на права');
            console.error('Failed to save permissions:', e);
        } finally {
            setSaving(null);
        }
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-display font-bold text-gray-900">Управление на права</h1>
                    <p className="text-sm font-sans text-gray-500 mt-1">Настройте какво може да прави всяка роля</p>
                </div>
            </div>

            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="break-words">{error}</span>
                </div>
            )}

            <div className="bg-white border border-gray-200 overflow-x-auto">
                <table className="w-full min-w-[700px]">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 sticky left-0 bg-gray-50 z-10">Роля</th>
                            {sections.map(s => (
                                <th key={s} className="text-center px-2 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">{SECTION_LABELS[s]}</th>
                            ))}
                            <th className="text-center px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Запази</th>
                        </tr>
                    </thead>
                    <tbody>
                        {permsToShow.map(rolePerm => {
                            const isAdmin = rolePerm.role === 'admin';
                            return (
                                <tr key={rolePerm.role} className={`border-b border-gray-100 last:border-0 ${isAdmin ? 'bg-purple-50/50' : 'hover:bg-gray-50'}`}>
                                    <td className="px-4 py-3 sticky left-0 bg-white z-10">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider ${isAdmin ? 'bg-zn-purple text-white' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {ROLE_LABELS[rolePerm.role] || rolePerm.role}
                                            </span>
                                        </div>
                                    </td>
                                    {sections.map(s => {
                                        const allowed = isAdmin ? true : rolePerm.permissions?.[s] ?? false;
                                        return (
                                            <td key={s} className="text-center px-2 py-3">
                                                <button
                                                    onClick={() => toggle(rolePerm.role, s)}
                                                    disabled={isAdmin}
                                                    className={`w-7 h-7 inline-flex items-center justify-center border transition-colors ${allowed
                                                            ? 'bg-green-100 border-green-300 text-green-700'
                                                            : 'bg-red-50 border-red-200 text-red-400'
                                                        } ${isAdmin ? 'opacity-60 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'}`}
                                                >
                                                    {allowed ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                                </button>
                                            </td>
                                        );
                                    })}
                                    <td className="text-center px-4 py-3">
                                        {!isAdmin && (
                                            <button
                                                onClick={() => handleSave(rolePerm.role)}
                                                disabled={saving === rolePerm.role}
                                                className="px-3 py-1.5 bg-zn-purple text-white text-xs font-sans font-semibold hover:bg-zn-purple-dark transition-colors disabled:opacity-50"
                                            >
                                                {saving === rolePerm.role ? '...' : <><Save className="w-3 h-3 inline mr-1" />Запази</>}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm font-sans text-amber-800">
                    <strong>Забележка:</strong> Администраторът винаги има пълни права и не може да бъде ограничен.
                    Промените влизат в сила веднага след натискане на "Запази".
                </p>
            </div>
        </div>
    );
}
