import { useMemo, useState } from 'react';
import { useAdminData, usePublicData, useSessionData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';

const BASE_ROLES = Object.freeze(['admin', 'editor', 'reporter', 'photographer', 'intern']);
const ROLE_LABELS = Object.freeze({
  admin: 'Администратор',
  editor: 'Редактор',
  reporter: 'Репортер',
  photographer: 'Фотограф',
  intern: 'Стажант',
});

const AVATARS = ['👨‍💼', '👩‍💻', '👨‍🎤', '👩‍🎓', '🕵️', '👮', '👨‍⚕️', '👩‍🍳', '🧑‍💻', '👑', '📸', '✍️'];

const emptyForm = {
  name: '',
  username: '',
  password: '',
  role: 'reporter',
  profession: '',
  avatar: '👤',
};

export default function ManageProfiles() {
  const { authors, articles, addAuthor, updateAuthor, deleteAuthor } = usePublicData();
  const { users, addUser, updateUser, deleteUser, permissions, createRole } = useAdminData();
  const { session } = useSessionData();
  const canManageUsers = session?.role === 'admin';
  const [editing, setEditing] = useState(null); // null | 'new' | userId
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState('users'); // 'users' | 'authors'
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleError, setNewRoleError] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const toast = useToast();

  const isValidRoleKey = (role) => /^[a-z][a-z0-9_-]{1,31}$/.test(role);

  const roleOptions = useMemo(() => {
    const permsRoles = Array.isArray(permissions)
      ? permissions.map(p => p?.role).filter(Boolean)
      : [];
    const extraRoles = [...new Set(permsRoles.filter(r => !BASE_ROLES.includes(r)))]
      .sort((a, b) => a.localeCompare(b));
    return [...BASE_ROLES, ...extraRoles].map(value => ({
      value,
      label: ROLE_LABELS[value] || value,
    }));
  }, [permissions]);

  // --- Author form ---
  const [authorForm, setAuthorForm] = useState({ name: '', avatar: '👤', role: '' });
  const [editingAuthor, setEditingAuthor] = useState(null);

  const handleSaveUser = async () => {
    if (!form.name || !form.username) return;
    if (editing === 'new') {
      await addUser(form);
      toast.success('Потребителят е добавен');
    } else {
      await updateUser(editing, form);
      toast.success('Потребителят е актуализиран');
    }
    setEditing(null);
    setForm(emptyForm);
  };

  const handleDeleteUser = async (id) => {
    if (id === 1) return toast.warning('Не може да изтриете главния админ!');
    if (!confirm('Сигурен ли сте?')) return;
    await deleteUser(id);
    toast.success('Потребителят е изтрит');
  };

  const handleEnsureRole = async () => {
    const role = newRoleKey.trim().toLowerCase();
    if (!role) return;
    if (creatingRole) return;

    setNewRoleError('');

    if (role === 'admin' || BASE_ROLES.includes(role)) {
      setNewRoleError('Тази роля е вградена. Избери я от списъка.');
      return;
    }
    if (!isValidRoleKey(role)) {
      setNewRoleError('Невалидна роля. Ползвай малки латински букви, цифри, "_" или "-".');
      return;
    }

    setCreatingRole(true);
    try {
      const ensured = await createRole(role);
      setForm((prev) => ({ ...prev, role: ensured.role }));
      setNewRoleKey('');
    } catch (e) {
      setNewRoleError(e?.message || 'Неуспешно добавяне на роля');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleSaveAuthor = async () => {
    if (!authorForm.name) return;
    if (editingAuthor === 'new') {
      await addAuthor(authorForm);
      toast.success('Авторът е добавен');
    } else {
      await updateAuthor(editingAuthor, authorForm);
      toast.success('Авторът е актуализиран');
    }
    setEditingAuthor(null);
    setAuthorForm({ name: '', avatar: '👤', role: '' });
  };

  const handleDeleteAuthor = async (id) => {
    if (!confirm('Сигурен ли сте?')) return;
    await deleteAuthor(id);
    toast.success('Авторът е изтрит');
  };

  const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple";
  const labelCls = "block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Профили</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Управление на потребители и автори</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {[
          { id: 'users', label: 'Потребители (акаунти)' },
          { id: 'authors', label: 'Автори (репортери)' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-sans font-medium border-b-2 transition-colors ${tab === t.id ? 'border-zn-purple text-zn-hot' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <>
          {canManageUsers && (
            <button
              onClick={() => { setEditing('new'); setForm(emptyForm); }}
              className="mb-4 flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Нов потребител
            </button>
          )}

          {/* Edit / New form */}
          {editing && canManageUsers && (
            <div className="bg-white border border-gray-200 p-6 mb-6">
              <h3 className="font-sans font-semibold text-gray-900 mb-4">
                {editing === 'new' ? 'Нов потребител' : 'Редактирай потребител'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Име</label>
                  <input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Иван Иванов" />
                </div>
                <div>
                  <label className={labelCls}>Потребителско име</label>
                  <input className={inputCls} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="ivan" />
                </div>
                <div>
                  <label className={labelCls}>Парола</label>
                  <input className={inputCls} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••" />
                </div>
                <div>
                  <label className={labelCls}>Роля</label>
                  <select className={inputCls} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <div className="mt-2">
                    <div className="flex gap-2">
                      <input
                        className={inputCls}
                        value={newRoleKey}
                        onChange={(e) => setNewRoleKey(e.target.value)}
                        placeholder="Нова роля (напр. moderator)"
                      />
                      <button
                        type="button"
                        onClick={handleEnsureRole}
                        disabled={creatingRole}
                        className="px-3 py-2 bg-gray-900 text-white text-xs font-sans font-semibold hover:bg-black transition-colors disabled:opacity-50"
                        title="Добави роля"
                      >
                        {creatingRole ? '...' : 'Добави'}
                      </button>
                    </div>
                    {newRoleError && (
                      <p className="mt-1 text-xs font-sans text-red-600">{newRoleError}</p>
                    )}
                    <p className="mt-1 text-[10px] font-sans text-gray-400">
                      Ролята създава нов ред в „Права“, с изключени разрешения по подразбиране.
                    </p>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Професия</label>
                  <input className={inputCls} value={form.profession} onChange={e => setForm({ ...form, profession: e.target.value })} placeholder="Криминален репортер" />
                </div>
                <div>
                  <label className={labelCls}>Аватар</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AVATARS.map(a => (
                      <button
                        key={a}
                        onClick={() => setForm({ ...form, avatar: a })}
                        className={`w-8 h-8 text-lg flex items-center justify-center border transition-colors ${form.avatar === a ? 'border-zn-purple bg-zn-purple/10' : 'border-gray-200 hover:border-gray-400'
                          }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={handleSaveUser} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors">
                  <Save className="w-4 h-4" />
                  Запази
                </button>
                <button onClick={() => setEditing(null)} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors">
                  <X className="w-4 h-4" />
                  Откажи
                </button>
              </div>
            </div>
          )}

          {/* Users table */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Потребител</th>
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Username</th>
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Роля</th>
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Професия</th>
                  <th className="text-right px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{user.avatar || '👤'}</span>
                        <span className="text-sm font-sans font-medium text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-sans text-gray-500">{user.username}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider ${user.role === 'admin' ? 'bg-zn-purple text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                        {roleOptions.find(r => r.value === user.role)?.label || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-sans text-gray-500">{user.profession || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canManageUsers ? (
                          <>
                            <button
                              onClick={() => { setEditing(user.id); setForm(user); }}
                              className="p-1.5 text-gray-400 hover:text-zn-hot transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {user.id !== 1 && (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-sans text-gray-300 px-1.5">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'authors' && (
        <>
          <button
            onClick={() => { setEditingAuthor('new'); setAuthorForm({ name: '', avatar: '👤', role: '' }); }}
            className="mb-4 flex items-center gap-2 px-4 py-2 bg-zn-hot text-white text-sm font-sans font-semibold hover:bg-zn-hot transition-colors"
          >
            <Plus className="w-4 h-4" />
            Нов автор
          </button>

          {editingAuthor && (
            <div className="bg-white border border-gray-200 p-6 mb-6">
              <h3 className="font-sans font-semibold text-gray-900 mb-4">
                {editingAuthor === 'new' ? 'Нов автор' : 'Редактирай автор'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Име</label>
                  <input className={inputCls} value={authorForm.name} onChange={e => setAuthorForm({ ...authorForm, name: e.target.value })} placeholder="Марко Николич" />
                </div>
                <div>
                  <label className={labelCls}>Позиция</label>
                  <input className={inputCls} value={authorForm.role} onChange={e => setAuthorForm({ ...authorForm, role: e.target.value })} placeholder="Криминален репортер" />
                </div>
                <div>
                  <label className={labelCls}>Аватар</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AVATARS.map(a => (
                      <button
                        key={a}
                        onClick={() => setAuthorForm({ ...authorForm, avatar: a })}
                        className={`w-8 h-8 text-lg flex items-center justify-center border transition-colors ${authorForm.avatar === a ? 'border-zn-purple bg-zn-purple/10' : 'border-gray-200 hover:border-gray-400'
                          }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={handleSaveAuthor} className="flex items-center gap-2 px-5 py-2 bg-zn-hot text-white text-sm font-sans font-semibold hover:bg-zn-hot transition-colors">
                  <Save className="w-4 h-4" /> Запази
                </button>
                <button onClick={() => setEditingAuthor(null)} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors">
                  <X className="w-4 h-4" /> Откажи
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Автор</th>
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Позиция</th>
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Статии</th>
                  <th className="text-right px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Действия</th>
                </tr>
              </thead>
              <tbody>
                {authors.map(author => {
                  return (
                    <tr key={author.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{author.avatar}</span>
                          <span className="text-sm font-sans font-medium text-gray-900">{author.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-sans text-gray-500">{author.role}</td>
                      <td className="px-4 py-3 text-sm font-sans text-gray-500">{articles.filter(a => a.authorId === author.id).length}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditingAuthor(author.id); setAuthorForm(author); }}
                            className="p-1.5 text-gray-400 hover:text-zn-hot transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAuthor(author.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
