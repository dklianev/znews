import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminData, useSessionData } from '../../context/DataContext';
import { Shield, Save, Check, X, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import AdminSearchField from '../../components/admin/AdminSearchField';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { buildAdminSearchParams, readSearchParam } from '../../utils/adminSearchParams';

const SECTION_LABELS = {
    articles: 'Статии',
    categories: 'Категории',
    ads: 'Реклами',
    breaking: 'Тикер / Извънредни',
    wanted: 'Издирвани',
    jobs: 'Обяви',
    classifieds: 'Малки обяви',
    court: 'Съд',
    events: 'Събития',
    polls: 'Анкети',
    comments: 'Коментари',
    contact: 'Контакти',
    gallery: 'Галерия',
    profiles: 'Профили',
    permissions: 'Права',
    games: 'Игри',
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

function buildPresetPermissions(enabledSections) {
    const allowed = new Set(enabledSections);
    return sections.reduce((result, section) => {
        result[section] = allowed.has(section);
        return result;
    }, {});
}

const PERMISSION_PRESETS = Object.freeze({
    editor: {
        label: 'Редактор',
        description: 'Редакционна работа, публикации и входящи сигнали.',
        permissions: buildPresetPermissions(['articles', 'categories', 'breaking', 'comments', 'contact', 'gallery', 'profiles']),
    },
    moderator: {
        label: 'Модератор',
        description: 'Модерация на общността и входящите канали.',
        permissions: buildPresetPermissions(['comments', 'contact', 'gallery', 'classifieds']),
    },
    classifieds_manager: {
        label: 'Мениджър обяви',
        description: 'Управление на малки обяви и входящи клиентски заявки.',
        permissions: buildPresetPermissions(['classifieds', 'contact']),
    },
    games_curator: {
        label: 'Куратор игри',
        description: 'Игри, пъзели и леки интерактивни формати.',
        permissions: buildPresetPermissions(['games', 'polls']),
    },
});

function ensureRoleRows(value) {
    const items = Array.isArray(value) ? value : [];
    const byRole = new Map(items.map(p => [p?.role, p]).filter(([role]) => role));
    const baseRows = BASE_ROLES.map(role => byRole.get(role) || { role, permissions: {} });
    const extras = items.filter(p => p?.role && !BASE_ROLES.includes(p.role));
    return [...baseRows, ...extras];
}

function normalizeRolePermissions(value) {
    return sections.reduce((result, section) => {
        result[section] = Boolean(value?.[section]);
        return result;
    }, {});
}

function buildPermissionDiff(currentPermissions, nextPermissions) {
    const current = normalizeRolePermissions(currentPermissions);
    const next = normalizeRolePermissions(nextPermissions);
    return sections.flatMap((section) => {
        if (current[section] === next[section]) return [];
        return [{
            section,
            label: SECTION_LABELS[section],
            nextValue: next[section],
        }];
    });
}

export default function ManagePermissions() {
    const { permissions, updatePermission, createRole, hasPermission } = useAdminData();
    const { session } = useSessionData();
    const [saving, setSaving] = useState(null);
    const [localPerms, setLocalPerms] = useState(null);
    const [error, setError] = useState('');
    const [newRoleKey, setNewRoleKey] = useState('');
    const [creatingRole, setCreatingRole] = useState(false);
    const [presetRole, setPresetRole] = useState('editor');
    const [selectedPresetKey, setSelectedPresetKey] = useState('editor');
    const [searchParams, setSearchParams] = useSearchParams();
    const query = readSearchParam(searchParams, 'q', '');
    const toast = useToast();
    const confirm = useConfirm();

    const setListSearchParams = (updates) => {
        setSearchParams(
            (current) => buildAdminSearchParams(current, updates),
            { replace: true },
        );
    };

    // Use local copy for editing, fall back to fetched data
    const permsToShow = ensureRoleRows(localPerms || permissions);
    const filteredPerms = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return permsToShow;
        return permsToShow.filter((rolePerm) => {
            const roleKey = String(rolePerm.role || '').toLowerCase();
            const roleLabel = String(ROLE_LABELS[rolePerm.role] || rolePerm.role || '').toLowerCase();
            return roleKey.includes(normalizedQuery) || roleLabel.includes(normalizedQuery);
        });
    }, [permsToShow, query]);
    const editableRoles = useMemo(
        () => permsToShow.filter((rolePerm) => rolePerm.role !== 'admin'),
        [permsToShow],
    );
    const selectedPreset = selectedPresetKey ? PERMISSION_PRESETS[selectedPresetKey] : null;
    const presetTargetRole = useMemo(
        () => editableRoles.find((rolePerm) => rolePerm.role === presetRole) || null,
        [editableRoles, presetRole],
    );
    const presetDiff = useMemo(() => {
        if (!presetTargetRole || !selectedPreset) return [];
        return buildPermissionDiff(presetTargetRole.permissions, selectedPreset.permissions);
    }, [presetTargetRole, selectedPreset]);
    const enabledPresetSections = useMemo(() => {
        if (!selectedPreset) return [];
        return sections.filter((section) => Boolean(selectedPreset.permissions?.[section]));
    }, [selectedPreset]);
    const addedPresetSections = useMemo(
        () => presetDiff.filter((item) => item.nextValue),
        [presetDiff],
    );
    const removedPresetSections = useMemo(
        () => presetDiff.filter((item) => !item.nextValue),
        [presetDiff],
    );

    useEffect(() => {
        if (editableRoles.length === 0) {
            setPresetRole('');
            return;
        }
        if (editableRoles.some((rolePerm) => rolePerm.role === presetRole)) return;
        setPresetRole(editableRoles[0].role);
    }, [editableRoles, presetRole]);

    useEffect(() => {
        if (selectedPresetKey && PERMISSION_PRESETS[selectedPresetKey]) return;
        setSelectedPresetKey(Object.keys(PERMISSION_PRESETS)[0] || '');
    }, [selectedPresetKey]);

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
            toast.success(`Правата за ${role} са запазени`);
        } catch (e) {
            setError(e?.message || 'Неуспешен запис на права');
            toast.error('Грешка при запис на права');
            console.error('Failed to save permissions:', e);
        } finally {
            setSaving(null);
        }
    };

    const isValidRoleKey = (role) => /^[a-z][a-z0-9_-]{1,31}$/.test(role);

    const handleAddRole = async () => {
        const role = String(newRoleKey || '').trim().toLowerCase();
        if (!role) return;
        if (creatingRole) return;

        setError('');
        if (role === 'admin' || BASE_ROLES.includes(role)) {
            setError('Тази роля е вградена. Не може да се добавя оттук.');
            return;
        }
        if (!isValidRoleKey(role)) {
            setError('Невалидна роля. Ползвай малки латински букви, цифри, "_" или "-".');
            return;
        }

        setCreatingRole(true);
        try {
            const ensured = await createRole(role);
            setLocalPerms((prev) => {
                const base = ensureRoleRows(Array.isArray(prev) ? prev : permissions);
                if (base.some((p) => p?.role === ensured.role)) return base;
                return [...base, ensured];
            });
            setNewRoleKey('');
            toast.success(`Ролята "${role}" е добавена`);
        } catch (e) {
            setError(e?.message || 'Неуспешно добавяне на роля');
            toast.error('Грешка при добавяне');
        } finally {
            setCreatingRole(false);
        }
    };

    const applyPreset = async () => {
        if (!presetRole || !selectedPresetKey) return;
        const preset = PERMISSION_PRESETS[selectedPresetKey];
        if (!preset) return;

        const roleLabel = ROLE_LABELS[presetRole] || presetRole;
        const diff = buildPermissionDiff(presetTargetRole?.permissions, preset.permissions);
        if (diff.length === 0) {
            toast.info(`Ролята ${roleLabel} вече съвпада с шаблона "${preset.label}"`);
            return;
        }

        const addedLabels = diff.filter((item) => item.nextValue).map((item) => item.label);
        const removedLabels = diff.filter((item) => !item.nextValue).map((item) => item.label);
        const messageParts = [];
        if (addedLabels.length > 0) {
            messageParts.push(`Ще разрешиш: ${addedLabels.join(', ')}`);
        }
        if (removedLabels.length > 0) {
            messageParts.push(`Ще спреш: ${removedLabels.join(', ')}`);
        }

        const confirmed = await confirm({
            title: 'Прилагане на шаблон',
            message: `${roleLabel} ще бъде презаписана с шаблона "${preset.label}". ${messageParts.join(' · ')}`,
            confirmLabel: 'Приложи',
            cancelLabel: 'Отказ',
            variant: 'warning',
        });
        if (!confirmed) return;

        setLocalPerms((prev) => {
            const base = ensureRoleRows(Array.isArray(prev) ? prev : permissions);
            return base.map((rolePerm) => (
                rolePerm.role === presetRole
                    ? { ...rolePerm, permissions: { ...preset.permissions } }
                    : rolePerm
            ));
        });
        toast.success(`Шаблонът "${preset.label}" е приложен за ${roleLabel}`);
    };

    return (
        <div className="p-8">
            <AdminPageHeader
                title="Управление на права"
                description="Настройте какво може да прави всяка роля"
                icon={Shield}
            />

            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="break-words">{error}</span>
                </div>
            )}

            <AdminFilterBar className="mb-4">
                <AdminSearchField
                    value={query}
                    onChange={(event) => setListSearchParams({ q: event.target.value })}
                    placeholder="Търси роля по ключ или етикет"
                    ariaLabel="Търси роля по ключ или етикет"
                />
            </AdminFilterBar>

            <div className="mb-4 bg-white border border-gray-200 p-4">
                <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-2">Нова роля</p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        className="w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
                        value={newRoleKey}
                        onChange={(e) => setNewRoleKey(e.target.value)}
                        placeholder="напр. moderator"
                    />
                    <button
                        type="button"
                        onClick={handleAddRole}
                        disabled={creatingRole}
                        className="px-4 py-2 bg-gray-900 text-white text-sm font-sans font-semibold hover:bg-black transition-colors disabled:opacity-50"
                    >
                        {creatingRole ? '...' : 'Добави'}
                    </button>
                </div>
                <p className="mt-2 text-[10px] font-sans text-gray-400">
                    Формат: малки латински букви, цифри, "_" или "-" (2-32 символа). Новите роли започват без права.
                </p>
            </div>

            <div className="mb-4 bg-white border border-gray-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-2">Шаблони за роли</p>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <label className="min-w-[220px]">
                                <span className="mb-1 block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Роля</span>
                                <select
                                    value={presetRole}
                                    onChange={(event) => setPresetRole(event.target.value)}
                                    aria-label="Избери роля за шаблон"
                                    className="w-full border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-700 outline-none focus:border-zn-purple"
                                >
                                    {editableRoles.map((rolePerm) => (
                                        <option key={rolePerm.role} value={rolePerm.role}>
                                            {ROLE_LABELS[rolePerm.role] || rolePerm.role}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(PERMISSION_PRESETS).map(([presetKey, preset]) => (
                                    <button
                                        key={presetKey}
                                        type="button"
                                        onClick={() => setSelectedPresetKey(presetKey)}
                                        disabled={!presetRole}
                                        aria-pressed={selectedPresetKey === presetKey}
                                        className={`px-3 py-2 border text-xs font-sans font-semibold transition-colors disabled:opacity-50 ${
                                            selectedPresetKey === presetKey
                                                ? 'border-zn-purple bg-zn-purple/10 text-zn-purple'
                                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                        title={preset.description}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => void applyPreset()}
                                    disabled={!presetRole || !selectedPreset}
                                    className="px-3 py-2 bg-zn-purple text-white text-xs font-sans font-semibold hover:bg-zn-purple-dark disabled:opacity-50"
                                >
                                    Приложи шаблона
                                </button>
                            </div>
                        </div>
                    </div>
                    <p className="max-w-xl text-xs font-sans text-gray-500">
                        Приложи готова начална конфигурация, после прецизирай квадратчетата и запази ролята.
                    </p>
                </div>
                {selectedPreset ? (
                    <div className="mt-4 border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-sans font-semibold text-gray-900">
                                    Преглед на шаблона: {selectedPreset.label}
                                </p>
                                <p className="mt-1 text-xs font-sans text-gray-500">
                                    {selectedPreset.description}
                                </p>
                                <p className="mt-2 text-[11px] font-sans text-gray-600">
                                    Активни секции: {enabledPresetSections.map((section) => SECTION_LABELS[section]).join(', ') || 'Няма'}
                                </p>
                            </div>
                            <div className="shrink-0 text-xs font-sans text-gray-500">
                                Промени за {ROLE_LABELS[presetRole] || presetRole || 'ролята'}: {presetDiff.length}
                            </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                                <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-600">Ще се разрешат</p>
                                {addedPresetSections.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {addedPresetSections.map((item) => (
                                            <span
                                                key={`added-${item.section}`}
                                                className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-sans font-medium text-emerald-700"
                                            >
                                                {item.label}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-xs font-sans text-gray-400">Няма нови разрешения.</p>
                                )}
                            </div>
                            <div>
                                <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-red-600">Ще се спрат</p>
                                {removedPresetSections.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {removedPresetSections.map((item) => (
                                            <span
                                                key={`removed-${item.section}`}
                                                className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-sans font-medium text-red-700"
                                            >
                                                {item.label}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-xs font-sans text-gray-400">Няма секции за спиране.</p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="bg-white border border-gray-200 overflow-x-auto">
                {filteredPerms.length === 0 ? (
                    <AdminEmptyState
                        title="Няма роли"
                        description="Промени търсенето, за да видиш съвпадащи роли и права."
                        className="m-4"
                    />
                ) : (
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
                            {filteredPerms.map(rolePerm => {
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
                                            const roleLabel = ROLE_LABELS[rolePerm.role] || rolePerm.role;
                                            return (
                                                <td key={s} className="text-center px-2 py-3">
                                                    <button
                                                        onClick={() => toggle(rolePerm.role, s)}
                                                        disabled={isAdmin}
                                                        aria-label={`${allowed ? 'Отнеми' : 'Разреши'} достъп до ${SECTION_LABELS[s]} за ${roleLabel}`}
                                                        title={`${allowed ? 'Отнеми' : 'Разреши'} достъп`}
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
                )}
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
